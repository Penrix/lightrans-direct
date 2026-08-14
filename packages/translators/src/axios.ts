import axios from "axios";
import type { AxiosInstance, AxiosRequestConfig } from "axios";

/**
 * MV3 service worker 兼容 adapter。
 *
 * 背景 service worker 运行在非 DOM 环境，**没有 XMLHttpRequest**，
 * 而 axios 0.27.2 的默认 adapter（xhr / http）都依赖 XHR / process，
 * 解析不到可用 adapter 时会抛 `(e.adapter || a.adapter) is not a function`，
 * 导致所有翻译网络请求失败。这里提供一个基于全局 fetch 的 adapter，
 * 在缺少 XMLHttpRequest 的环境（即后台 SW）下启用；其余上下文（弹窗 / 内容脚本）
 * 仍有 XHR，保持 axios 默认行为不变。
 *
 * @returns axios adapter 函数
 */
function createFetchAdapter(): any {
    return function fetchAdapter(config: any) {
        return new Promise((resolve, reject) => {
            const url = (config.baseURL || "") + config.url;
            const init: RequestInit = {
                method: (config.method || "get").toUpperCase(),
                headers: (config.headers || {}) as any,
                body: config.data,
            };
            if (config.signal) {
                init.signal = config.signal;
            }

            fetch(url, init)
                .then(async (response: Response) => {
                    const responseType = config.responseType || "json";
                    let data: any;
                    if (responseType === "arraybuffer") {
                        data = await response.arrayBuffer();
                    } else if (responseType === "blob") {
                        data = await response.blob();
                    } else if (responseType === "text") {
                        data = await response.text();
                    } else {
                        // json / 未指定：先取文本，能解析 JSON 则解析（与 axios 行为一致）
                        const text = await response.text();
                        try {
                            data = text ? JSON.parse(text) : "";
                        } catch {
                            data = text;
                        }
                    }

                    const headers: Record<string, string> = {};
                    response.headers.forEach((value, key) => {
                        headers[key] = value;
                    });

                    const axiosResponse = {
                        data,
                        status: response.status,
                        statusText: response.statusText,
                        headers,
                        config,
                        request: response,
                    };

                    const validateStatus =
                        config.validateStatus ||
                        ((status: number) => status >= 200 && status < 300);

                    if (validateStatus(response.status)) {
                        resolve(axiosResponse);
                    } else {
                        const error: any = new Error(
                            "Request failed with status code " + response.status
                        );
                        error.config = config;
                        error.response = axiosResponse;
                        error.isAxiosError = true;
                        reject(error);
                    }
                })
                .catch((error) => reject(error));
        });
    };
}

// 仅在 service worker 等无 XHR 环境启用 fetch adapter，避免影响其它上下文。
if (typeof XMLHttpRequest === "undefined") {
    axios.defaults.adapter = createFetchAdapter();
}

/**
 * Intercept axios() to add error handling.
 *
 * @param target axios instance
 * @param thisArg not used
 * @param args args passed to axios()
 *
 * @returns {Promise<Any>} response Promise
 */
async function applyTrap(target: AxiosInstance, _thisArg: any, args: [AxiosRequestConfig]) {
    try {
        return await target(...args);
    } catch (error: any) {
        throw {
            errorType: "NET_ERR",
            errorCode: 0,
            errorMsg: error.message,
        };
    }
}

/**
 * Intercept the method getting operation to add error handling for axios methods.
 *
 * @param target axios instance
 * @param propName property name.
 *
 * @returns If the property is a function, return a wrapper with error handling for it. If the property is not a function, just return it.
 */
function getTrap(target: AxiosInstance, propName: string) {
    const prop = (target as any)[propName];

    // If the property is not a function, just return it.
    if (Object.prototype.toString.call(prop) !== "[object Function]") {
        return prop;
    }

    // If the property is a function, return a wrapper with error handling.
    return async (...args: any) => {
        try {
            // Using Promise.resolve to wrap up the return value of prop in case it is not a Promise.
            return await Promise.resolve(prop(...args));
        } catch (error: any) {
            throw {
                errorType: "NET_ERR",
                errorCode: 0,
                errorMsg: error.message,
            };
        }
    };
}

/**
 * Axios proxy with error handling.
 */
const AxiosProxy = new Proxy<AxiosInstance>(axios, {
    apply: applyTrap,
    get: getTrap,
});

export default AxiosProxy;
