#!/bin/bash
# Bootstrap script to create S3 bucket and DynamoDB table for Terraform Remote State
set -e

# Configuration
REGION="us-east-1"
PROJECT_NAME="sezar-drive"
BUCKET_NAME="${PROJECT_NAME}-tf-state-$(date +%s)"
TABLE_NAME="${PROJECT_NAME}-tf-lock"

echo "🚀 Bootstrapping Terraform Remote Backend..."

# 1. Create S3 Bucket
echo "Creating S3 bucket: $BUCKET_NAME..."
if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket $BUCKET_NAME --region $REGION
else
    aws s3api create-bucket --bucket $BUCKET_NAME --region $REGION --create-bucket-configuration LocationConstraint=$REGION
fi

# 2. Enable Versioning
echo "Enabling bucket versioning..."
aws s3api put-bucket-versioning --bucket $BUCKET_NAME --versioning-configuration Status=Enabled

# 3. Enable Encryption
echo "Enabling server-side encryption..."
aws s3api put-bucket-encryption --bucket $BUCKET_NAME --server-side-encryption-configuration '{
    "Rules": [
        {
            "ApplyServerSideEncryptionByDefault": {
                "SSEAlgorithm": "AES256"
            }
        }
    ]
}'

# 4. Block Public Access
echo "Blocking public access..."
aws s3api put-public-access-block --bucket $BUCKET_NAME --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# 5. Enforce SSL for all requests
echo "Enforcing SSL-only access..."
aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [
        {
            \"Sid\": \"AllowSSLRequestsOnly\",
            \"Effect\": \"Deny\",
            \"Principal\": \"*\",
            \"Action\": \"s3:*\",
            \"Resource\": [
                \"arn:aws:s3:::$BUCKET_NAME\",
                \"arn:aws:s3:::$BUCKET_NAME/*\"
            ],
            \"Condition\": {
                \"Bool\": {
                    \"aws:SecureTransport\": \"false\"
                }
            }
        }
    ]
}"

# 6. Create DynamoDB Table
echo "Creating DynamoDB table for state locking: $TABLE_NAME..."
aws dynamodb create-table \
    --table-name $TABLE_NAME \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --region $REGION

echo "✅ Bootstrap Complete!"
echo "------------------------------------------------"
echo "Add this to your terraform block in main.tf:"
echo ""
echo "backend \"s3\" {"
echo "  bucket         = \"$BUCKET_NAME\""
echo "  key            = \"state/terraform.tfstate\""
echo "  region         = \"$REGION\""
echo "  use_lockfile   = true"
echo "  encrypt        = true"
echo "}"
echo "------------------------------------------------"
