import { gzip } from 'pako';
import {  useErrorBoundary } from 'use-error-boundary';

const DEFAULT_ENDPOINT = "https://collect.ezlog.cloud/events/";

export interface ClientOptions {
	serviceKey?: string
	endpoint?:  string
}

let clientOption: ClientOptions = {};

interface detailInterface {
  level?: string;
  line?: number;
  msg?: string;
  file?: string;
  func?: string;
}

interface tracesSourceInterface {
  line?: number;
  source?: string;
}

interface traceInterface {
  file?: string;
  func?: string;
  line?: number;
  sources?: tracesSourceInterface[];
}

interface runtimeInterface {
  platform?: string;
  ver?: string;
}

interface requestDataInterface {
  detail: detailInterface;
  traces: traceInterface[];
  runtime: runtimeInterface;
}

export const Config = (options: ClientOptions) => {
  clientOption = options;
}

export const Exception = (error: unknown) => {
  if (!(error instanceof Error)) {
    return;
  }

  if (!clientOption.serviceKey) {
    return;
  }

  let endpoint = DEFAULT_ENDPOINT;
  if (clientOption.endpoint) {
    endpoint = clientOption.endpoint;
  }

  const detail: detailInterface = {
    level: "error",
    msg: error.message
  }

  const runtime: runtimeInterface = {
    platform: "react"
  }

  const traces = Array<traceInterface>();

  if (!error.stack) {
    return;
  }

  error.stack?.split("\n").forEach((line, index) => {
    if (index === 0) {
      return
    }

    const lineInfo =line.trim().replace("at ", "");
    const lineInfos = lineInfo.split(" ");
    let file = "";
    let func = "";
    if (lineInfos.length < 2) {
      file = lineInfos[0];
    } else {
      file = lineInfos[1];
      func = lineInfos[0];
    }

    file = file.replace("(", "").replace(")", "");
    let fileLine: number | undefined = undefined;

    var parser = new URL(file)
    let pathname = parser.pathname

    const pathInfos = pathname.split(":");
    pathname = pathInfos[0];
    if (pathInfos.length > 1) {
      fileLine = parseInt(pathInfos[1]);
    }

    file = parser.origin + pathname;

    if (index === 1) {
      detail.file = file;
      detail.func = func;
      if (fileLine) {
        detail.line = fileLine;
      }
    }

    traces.push({
      file: parser.origin + pathname,
      func: func,
      line: fileLine
    })

  })

  const data: requestDataInterface = {
    detail: detail,
    traces: traces,
    runtime: runtime
  }

  const request = {
    data: JSON.stringify(data)
  }
  const compressedData = gzip(JSON.stringify(request));

  const requestHeaders: HeadersInit = new Headers();
  requestHeaders.set("Content-Type", "application/json");
  requestHeaders.set("Content-Encoding", "gzip");
  requestHeaders.set("X-EZLOG-SERVICE-KEY", clientOption.serviceKey);

  try {
    fetch(endpoint, {
      method: "POST",
      mode: "cors",
      headers: requestHeaders,
      body: compressedData
    })
      .then((res) => {
        return;
      })
      .catch((error) => {
        throw error;
      });
  } catch (error) {
    // TODO: error handling
  }

  return;
}

interface Props {
  children?: React.ReactNode;
}

export const AppWithErrorBoundary: React.FunctionComponent<Props> = ({
  children,
}: Props) => {
  const { ErrorBoundary, didCatch, error } = useErrorBoundary();

  if (didCatch) {
    // エラーログを外部サービスに送信するなどの処理を行う
    console.error("ErrorBoundary caught an error", error);
    // return <FallbackComponent />;
  }

  return (
    <ErrorBoundary>{children}</ErrorBoundary>
  );
};
