-- CreateIndex
CREATE INDEX "notification_logs_timestamp_id_idx" ON "notification_logs"("timestamp" DESC, "id" DESC);
