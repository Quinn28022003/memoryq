export const Logging = {
    log: (message: string) => console.log(message),
    error: (message: string) => console.error(message),
    warn: (message: string) => console.warn(message),
    success: (message: string) => console.log(message),
    info: (message: string) => console.log(message),
    header: (message: string) => console.log(message),
    critical: (message: string) => console.error(message),
};
