FROM nginx:1.27-alpine
COPY templates /etc/nginx/templates
ENV WEB_UPSTREAM=web:80 NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz || exit 1
