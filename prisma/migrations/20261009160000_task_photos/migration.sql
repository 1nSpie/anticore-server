-- CreateTable
CREATE TABLE "task_photos" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "key" VARCHAR(200) NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedBy" VARCHAR(10) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "task_photos_key_key" ON "task_photos"("key");

-- CreateIndex
CREATE INDEX "task_photos_taskId_idx" ON "task_photos"("taskId");

-- AddForeignKey
ALTER TABLE "task_photos" ADD CONSTRAINT "task_photos_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

