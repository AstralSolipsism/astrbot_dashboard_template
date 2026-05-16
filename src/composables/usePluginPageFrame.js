import axios from "axios";
import { computed, onBeforeUnmount, onMounted, ref, toRaw, unref, watch } from "vue";
import { useModuleI18n } from "@/i18n/composables";
import { usePluginI18n } from "@/utils/pluginI18n";

const BRIDGE_CHANNEL = "astrbot-plugin-page";
const BRIDGE_TARGET_ORIGIN =
  typeof window !== "undefined" ? window.location.origin : "";

const toPostMessageData = (value, fallback = null) => {
  try {
    return JSON.parse(JSON.stringify(toRaw(value)));
  } catch {
    return fallback;
  }
};

const parseContentDispositionFilename = (headerValue) => {
  if (typeof headerValue !== "string") {
    return "download.bin";
  }

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const plainMatch = headerValue.match(/filename="?([^";]+)"?/i);
  if (plainMatch?.[1]) {
    return plainMatch[1];
  }
  return "download.bin";
};

const normalizePluginEndpoint = (endpoint) => {
  if (typeof endpoint !== "string") {
    throw new Error("Plugin bridge endpoint must be a string.");
  }

  const trimmed = endpoint.trim().replace(/^\/+/, "");
  if (!trimmed) {
    throw new Error("Plugin bridge endpoint cannot be empty.");
  }
  if (
    trimmed.includes("\\") ||
    trimmed.includes("://") ||
    trimmed.includes("?") ||
    trimmed.includes("#")
  ) {
    throw new Error("Plugin bridge endpoint is invalid.");
  }

  const segments = trimmed.split("/");
  if (
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error("Plugin bridge endpoint is invalid.");
  }
  return segments.map((segment) => encodeURIComponent(segment)).join("/");
};

const isBridgeUploadFile = (value) => {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (typeof File !== "undefined" && value instanceof File) {
    return true;
  }
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return true;
  }
  const tag = Object.prototype.toString.call(value);
  if (tag === "[object File]" || tag === "[object Blob]") {
    return true;
  }
  return (
    typeof value.arrayBuffer === "function" && typeof value.size === "number"
  );
};

const coerceBridgeUploadFile = async (value, fileName) => {
  if (!isBridgeUploadFile(value)) {
    throw new Error("Missing uploaded file payload.");
  }
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return value;
  }

  const buffer = await value.arrayBuffer();
  const fileType =
    typeof value.type === "string" && value.type
      ? value.type
      : "application/octet-stream";
  if (typeof File !== "undefined") {
    return new File([buffer], fileName, {
      type: fileType,
      lastModified:
        typeof value.lastModified === "number"
          ? value.lastModified
          : Date.now(),
    });
  }
  return new Blob([buffer], { type: fileType });
};

export function usePluginPageFrame(options) {
  const { tm } = useModuleI18n("features/extension");
  const {
    locale,
    pluginName: pluginDisplayName,
    pluginPageTitle,
  } = usePluginI18n();

  const loading = ref(false);
  const errorMessage = ref("");
  const plugin = ref(null);
  const page = ref(null);
  const iframeSrc = ref("");
  const iframeRef = ref(null);
  const sseConnections = new Map();
  let iframeMessageOrigin = null;
  let loadToken = 0;

  const optionPluginName = () => String(unref(options.pluginName) || "");
  const optionPageName = () => String(unref(options.pageName) || "");
  const optionActive = () => Boolean(unref(options.active));
  const optionPluginData = () => unref(options.pluginData);

  const localizedPageTitle = computed(() =>
    pluginPageTitle(
      plugin.value,
      page.value || optionPageName(),
      page.value?.title || optionPageName() || tm("buttons.openPages"),
    ),
  );

  const getIframeWindow = () => iframeRef.value?.contentWindow || null;

  const cleanupSSEConnections = () => {
    for (const eventSource of sseConnections.values()) {
      eventSource.close();
    }
    sseConnections.clear();
  };

  const resetFrame = () => {
    loadToken += 1;
    loading.value = false;
    errorMessage.value = "";
    plugin.value = null;
    page.value = null;
    iframeSrc.value = "";
    iframeMessageOrigin = null;
    cleanupSSEConnections();
  };

  const postToIframe = (payload) => {
    const iframeWindow = getIframeWindow();
    if (!iframeWindow) {
      return;
    }
    const targetOrigin =
      typeof iframeMessageOrigin === "string" && iframeMessageOrigin !== "null"
        ? iframeMessageOrigin
        : "*";
    iframeWindow.postMessage(
      { channel: BRIDGE_CHANNEL, ...payload },
      targetOrigin,
    );
  };

  const buildPluginApiPath = (endpoint) => {
    const normalized = normalizePluginEndpoint(endpoint);
    return `/api/plug/${encodeURIComponent(optionPluginName())}/${normalized}`;
  };

  const sendBridgeResponse = (requestId, ok, payload) => {
    postToIframe({
      kind: "response",
      requestId,
      ok,
      ...(ok ? { data: payload } : { error: payload }),
    });
  };

  const closeSSEConnection = (subscriptionId) => {
    const eventSource = sseConnections.get(subscriptionId);
    if (eventSource) {
      eventSource.close();
      sseConnections.delete(subscriptionId);
    }
  };

  const sendIframeContext = () => {
    if (!plugin.value || !page.value) {
      return;
    }
    postToIframe({
      kind: "context",
      context: {
        pluginName: plugin.value.name,
        displayName: pluginDisplayName(plugin.value),
        pageName: page.value.name,
        pageTitle: localizedPageTitle.value,
        locale: locale.value,
        i18n: toPostMessageData(plugin.value.i18n, {}),
      },
    });
  };

  const handleBridgeRequest = async (message) => {
    const { requestId, action } = message;
    try {
      if (!requestId) {
        throw new Error("Missing plugin bridge request id.");
      }

      if (action === "api:get") {
        const response = await axios.get(buildPluginApiPath(message.endpoint), {
          params: message.params || {},
        });
        if (response.data?.status === "error") {
          throw new Error(response.data.message || "Plugin GET request failed.");
        }
        sendBridgeResponse(requestId, true, response.data?.data ?? response.data);
        return;
      }

      if (action === "api:post") {
        const response = await axios.post(
          buildPluginApiPath(message.endpoint),
          message.body || {},
        );
        if (response.data?.status === "error") {
          throw new Error(response.data.message || "Plugin POST request failed.");
        }
        sendBridgeResponse(requestId, true, response.data?.data ?? response.data);
        return;
      }

      if (action === "files:upload") {
        const formData = new FormData();
        const uploadFile = await coerceBridgeUploadFile(
          message.file,
          typeof message.fileName === "string" && message.fileName
            ? message.fileName
            : "upload.bin",
        );
        formData.append("file", uploadFile);
        const response = await axios.post(
          buildPluginApiPath(message.endpoint),
          formData,
          {
            timeout: 60000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
          },
        );
        if (response.data?.status === "error") {
          throw new Error(
            response.data.message || "Plugin upload request failed.",
          );
        }
        sendBridgeResponse(requestId, true, response.data?.data ?? response.data);
        return;
      }

      if (action === "files:download") {
        const response = await axios.get(buildPluginApiPath(message.endpoint), {
          params: message.params || {},
          responseType: "blob",
        });
        const blobUrl = URL.createObjectURL(response.data);
        const anchor = document.createElement("a");
        anchor.href = blobUrl;
        anchor.download =
          (typeof message.filename === "string" && message.filename) ||
          parseContentDispositionFilename(
            response.headers["content-disposition"],
          );
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => {
          URL.revokeObjectURL(blobUrl);
        }, 0);
        sendBridgeResponse(requestId, true, { filename: anchor.download });
        return;
      }

      if (action === "sse:subscribe") {
        const subscriptionId = String(message.subscriptionId || "");
        if (!subscriptionId) {
          throw new Error("Missing SSE subscription id.");
        }
        closeSSEConnection(subscriptionId);
        const url = new URL(
          buildPluginApiPath(message.endpoint),
          window.location.origin,
        );
        Object.entries(message.params || {}).forEach(([key, value]) => {
          url.searchParams.set(key, String(value));
        });
        const eventSource = new EventSource(url.toString(), {
          withCredentials: true,
        });
        sseConnections.set(subscriptionId, eventSource);
        eventSource.onopen = () => {
          postToIframe({ kind: "sse_state", subscriptionId, state: "open" });
        };
        eventSource.onmessage = (event) => {
          postToIframe({
            kind: "sse_message",
            subscriptionId,
            data: event.data,
            lastEventId: event.lastEventId,
          });
        };
        eventSource.onerror = () => {
          if (eventSource.readyState === EventSource.CLOSED) {
            closeSSEConnection(subscriptionId);
            postToIframe({ kind: "sse_state", subscriptionId, state: "closed" });
            return;
          }
          postToIframe({ kind: "sse_state", subscriptionId, state: "error" });
        };
        sendBridgeResponse(requestId, true, { subscriptionId });
        return;
      }

      if (action === "sse:unsubscribe") {
        closeSSEConnection(String(message.subscriptionId || ""));
        sendBridgeResponse(requestId, true, {
          subscriptionId: message.subscriptionId,
        });
        return;
      }

      throw new Error(`Unsupported plugin bridge action: ${action}`);
    } catch (error) {
      sendBridgeResponse(
        requestId,
        false,
        error?.message || "Plugin bridge request failed.",
      );
    }
  };

  const handleWindowMessage = (event) => {
    const iframeWindow = getIframeWindow();
    if (!iframeWindow || event.source !== iframeWindow) {
      return;
    }
    if (event.origin !== BRIDGE_TARGET_ORIGIN && event.origin !== "null") {
      return;
    }
    if (iframeMessageOrigin && event.origin !== iframeMessageOrigin) {
      return;
    }
    iframeMessageOrigin = event.origin;

    const message = event.data;
    if (!message || message.channel !== BRIDGE_CHANNEL) {
      return;
    }

    if (message.kind === "ready") {
      sendIframeContext();
      return;
    }

    if (message.kind === "request") {
      void handleBridgeRequest(message);
    }
  };

  const handleIframeLoad = () => {
    sendIframeContext();
  };

  const resolvePluginData = async () => {
    const providedPlugin = optionPluginData();
    if (providedPlugin) {
      return providedPlugin;
    }
    const detailResponse = await axios.get("/api/plugin/detail", {
      params: {
        name: optionPluginName(),
      },
    });
    if (detailResponse.data?.status === "error") {
      throw new Error(
        detailResponse.data.message || tm("messages.pluginPageLoadFailed"),
      );
    }
    return detailResponse.data?.data || null;
  };

  const loadPluginPage = async () => {
    if (!optionActive() || !optionPluginName() || !optionPageName()) {
      resetFrame();
      return;
    }

    const currentToken = loadToken + 1;
    loadToken = currentToken;
    loading.value = true;
    errorMessage.value = "";
    plugin.value = null;
    page.value = null;
    iframeSrc.value = "";
    iframeMessageOrigin = null;
    cleanupSSEConnections();

    try {
      const pluginData = await resolvePluginData();
      if (loadToken !== currentToken) return;
      if (!pluginData) {
        errorMessage.value = tm("messages.pluginNotFound");
        return;
      }

      if (!pluginData.activated) {
        errorMessage.value = tm("messages.pluginDisabled");
        return;
      }

      const entryResponse = await axios.get("/api/plugin/page/entry", {
        params: {
          name: optionPluginName(),
          page: optionPageName(),
        },
      });
      if (loadToken !== currentToken) return;
      if (entryResponse.data?.status === "error") {
        throw new Error(
          entryResponse.data.message || tm("messages.pluginPageLoadFailed"),
        );
      }

      const pageEntry = entryResponse.data?.data || null;
      if (
        !pageEntry ||
        typeof pageEntry.content_path !== "string" ||
        !pageEntry.content_path.length
      ) {
        errorMessage.value = tm("messages.pluginPageNotFound");
        return;
      }

      plugin.value = pluginData;
      page.value = pageEntry;
      iframeSrc.value = pageEntry.content_path;
    } catch (error) {
      if (loadToken !== currentToken) return;
      errorMessage.value =
        error?.response?.data?.message ||
        error?.message ||
        tm("messages.pluginPageLoadFailed");
    } finally {
      if (loadToken === currentToken) {
        loading.value = false;
      }
    }
  };

  onMounted(() => {
    window.addEventListener("message", handleWindowMessage);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("message", handleWindowMessage);
    resetFrame();
  });

  watch(
    [() => optionPluginName(), () => optionPageName(), () => optionActive()],
    loadPluginPage,
    { immediate: true },
  );

  watch(locale, () => {
    sendIframeContext();
  });

  return {
    loading,
    errorMessage,
    plugin,
    page,
    iframeSrc,
    iframeRef,
    localizedPageTitle,
    loadPluginPage,
    handleIframeLoad,
    resetFrame,
  };
}
