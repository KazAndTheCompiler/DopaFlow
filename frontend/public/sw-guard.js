(function () {
  const isLoopback =
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost";

  if (!("serviceWorker" in navigator)) {
    return;
  }

  if (isLoopback) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      })
      .catch(() => undefined);
    return;
  }

  navigator.serviceWorker.register("./sw.js").catch(() => undefined);
})();
