-- CreateTable
CREATE TABLE "device_push_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" VARCHAR(512) NOT NULL,
    "platform" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_push_tokens_token_key" ON "device_push_tokens"("token");

-- CreateIndex
CREATE INDEX "device_push_tokens_user_id_idx" ON "device_push_tokens"("user_id");

-- AddForeignKey
ALTER TABLE "device_push_tokens" ADD CONSTRAINT "device_push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
