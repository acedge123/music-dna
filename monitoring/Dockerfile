FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
# Explicit copies prevent runtime state, receipts, app code and secrets entering image.
COPY monitoring/__init__.py monitoring/core.py monitoring/worker.py monitoring/config.json /app/monitoring/
COPY monitoring/sql /app/monitoring/sql
RUN useradd --uid 10001 --no-create-home monitor
USER 10001:10001
CMD ["python", "-m", "monitoring.worker", "--state-dir", "/data/musicdna-monitoring", "--loop", "--send"]
