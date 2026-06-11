const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    "/api",
    createProxyMiddleware({
      target: "http://localhost:8000",
      changeOrigin: true,
      secure: false,
      on: {
        error: (err, req, res) => {
          console.error("[proxy] error:", err.message);
          if (!res.headersSent) {
            res.status(502).json({ detail: "Backend proxy error" });
          }
        },
      },
    })
  );
};
