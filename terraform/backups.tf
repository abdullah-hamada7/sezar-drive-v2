# ─── PostgreSQL Backup S3 Bucket ─────────────────────────────────────────────
# Dedicated S3 bucket for database backups (separate from photos bucket)
#
# Retention policy enforced via S3 Lifecycle rules:
#   daily/   → expires after  7 days
#   weekly/  → expires after 28 days  (~4 weeks)
#   monthly/ → expires after 90 days  (~3 months)
# ---------------------------------------------------------------------------

resource "aws_s3_bucket" "db_backups" {
  bucket        = "${var.project_name}-db-backups-${random_id.bucket_id.hex}"
  force_destroy = false # Never auto-delete production backups
  tags = merge(local.common_tags, {
    Purpose = "database-backups"
  })
}

resource "aws_s3_bucket_versioning" "db_backups" {
  bucket = aws_s3_bucket.db_backups.id
  versioning_configuration {
    status = "Suspended" # Not needed; lifecycle handles retention
  }
}

resource "aws_s3_bucket_public_access_block" "db_backups" {
  bucket = aws_s3_bucket.db_backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "db_backups" {
  bucket = aws_s3_bucket.db_backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# ─── Lifecycle: Auto-expire backups per retention policy ──────────────────────
resource "aws_s3_bucket_lifecycle_configuration" "db_backups" {
  bucket = aws_s3_bucket.db_backups.id

  rule {
    id     = "expire-daily-backups"
    status = "Enabled"

    filter {
      prefix = "daily/"
    }

    expiration {
      days = 7
    }
  }

  rule {
    id     = "expire-weekly-backups"
    status = "Enabled"

    filter {
      prefix = "weekly/"
    }

    expiration {
      days = 28
    }
  }

  rule {
    id     = "expire-monthly-backups"
    status = "Enabled"

    filter {
      prefix = "monthly/"
    }

    expiration {
      days = 90
    }
  }
}

# ─── Bucket Policy: HTTPS-only ─────────────────────────────────────────────
data "aws_iam_policy_document" "db_backups_policy" {
  statement {
    sid    = "DenyInsecureTransport"
    effect = "Deny"

    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions = ["s3:*"]

    resources = [
      aws_s3_bucket.db_backups.arn,
      "${aws_s3_bucket.db_backups.arn}/*",
    ]

    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "db_backups" {
  bucket = aws_s3_bucket.db_backups.id
  policy = data.aws_iam_policy_document.db_backups_policy.json

  # Must depend on the public access block being applied first
  depends_on = [aws_s3_bucket_public_access_block.db_backups]
}
