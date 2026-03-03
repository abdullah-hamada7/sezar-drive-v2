# Master Deployment Guide: Sezar Drive Platform

**Version**: 3.0  
**Author Role**: DevOps Engineer  
**Date**: 2026-02-21  
**Change Log**: Complete rewrite. Integrated Terraform (Infra), Cloudflare (DNS), and Docker Compose (App) into a single beginning-to-end workflow.

---

## Introduction

This guide provides the complete sequence to deploy Sezar Drive from scratch to a production-ready AWS environment. We use **Terraform** for infrastructure, **Docker Compose** for orchestration, and **Caddy** for automated SSL.

---

## Phase 1: Local Prerequisites

Before you begin, ensure your local machine has:

1. **AWS CLI**: Installed and configured (`aws configure`).
2. **Terraform**: Installed (version >= 1.0.0).
3. **SSH Key**: An AWS Key Pair created in `us-east-1` (or your target region).

---

## Phase 2: Infrastructure Provisioning (Terraform)

Terraform creates your VPC, Security Groups, S3 Bucket, IAM Roles, and the EC2 Instance.

1. **Navigate to the terraform directory**:

    ```bash
    cd terraform
    ```

2. **Initialize Terraform**:

    ```bash
    terraform init
    ```

3. **Deploy the infrastructure**:

    ```bash
    # You will be prompted for ssh_cidr_blocks (your IP/32) and key_name
    terraform apply
    ```

4. **Note the Outputs**:
    - `public_ip`: Your server's static Elastic IP.
    - `s3_bucket_name`: The auto-generated bucket name.
    - `ssh_command`: The command used to log in.

---

## Phase 3: DNS Configuration (Cloudflare)

Since we are staying in the **AWS Free Tier**, we manage DNS externally.

1. **Login to [Cloudflare](https://dash.cloudflare.com/)**.
2. **Select your domain** (`sezardrive.com`).
3. **Go to DNS > Records**.
4. **Add an 'A' Record**:
    - **Type**: `A`
    - **Name**: `@` (represents the root domain)
    - **IPv4 address**: Paste the `public_ip` from Terraform.
    - **Proxy status**: Proxied (Orange cloud) is recommended.
5. **Add a 'WWW' Record**:
    - **Type**: `CNAME`
    - **Name**: `www`
    - **Target**: `sezardrive.com`

---

## Phase 4: Server Preparation

1. **SSH into the server**:

    ```bash
    # Use the ssh_command from Terraform output
    ssh -i "your-key.pem" ubuntu@<PUBLIC_IP>
    ```

2. **Wait for Docker**: The server runs an automatic setup script on first boot. Wait ~5 minutes, then check if Docker is ready:

    ```bash
    docker --version
    docker compose version
    ```

---

## Phase 5: Application Deployment

1. **Clone the Repository**:

    ```bash
    git clone https://github.com/your-org/sezar-drive.git
    cd sezar-drive
    ```

2. **Configure Environment Variables**:

    ```bash
    cp .env.prod.example .env
    nano .env
    ```

    Set the following:
    - `DOMAIN_NAME`: `sezardrive.com`
    - `EMAIL_FOR_SSL`: `your-email@example.com`
    - `FRONTEND_URL`: `https://sezardrive.com`
    - `POSTGRES_PASSWORD`: (Generate a strong password)
    - `JWT_SECRET`: (Generate a strong 64-char string)
    - `S3_BUCKET`: (From Terraform output)
    - `S3_REGION`: `us-east-1`
3. **Start the Containers**:

    ```bash
    docker compose -f compose.prod.yml up -d --build
    ```

---

## Phase 6: Database & Initial Setup

1. **Run Migrations**:

    ```bash
    docker compose -f compose.prod.yml exec backend npx prisma migrate deploy
    ```

2. **Seed the Admin User**:

    ```bash
    docker compose -f compose.prod.yml exec backend npm run seed
    ```

---

## Phase 7: Enabling SSL (HTTPS)

1. **Edit `Caddyfile`**:

    ```bash
    nano Caddyfile
    ```

    - Remove/Comment out `auto_https off`.
2. **Update `compose.prod.yml`**:
    - Uncomment the port `"443:443"`.
3. **Restart**:

    ```bash
    docker compose -f compose.prod.yml up -d
    ```

---

## Maintenance & Verification

- **Check Logs**: `docker compose -f compose.prod.yml logs -f backend`
- **Security**: If your home IP changes and you lose SSH access, update `ssh_cidr_blocks` in `terraform.tfvars` and run `terraform apply` again.
- **Daily Backups**: Automated script runs at 03:00 UTC and uploads to S3.

---

---

## Phase 8: Modifying Infrastructure (e.g., Change Instance Type)

If you need to change the server's CPU/RAM (Instance Type), Terraform can handle this automatically.

1. **Edit Configuration**: Open `terraform/terraform.tfvars` and update the `instance_type` (e.g., from `t3-micro` to `c7i-flex.large`).
2. **Apply Changes**:

    ```bash
    cd terraform
    terraform apply
    ```

    Terraform will show a plan to **replace** the instance.
3. **Re-deploy Application**: Since the instance is new, you must follow **Phase 4, 5, and 6** again to install Docker, clone the code, and start the containers.

> [!WARNING]
> Replacing the instance will wipe any data stored *locally* on the server. Ensure your database is backed up or using an external volume if data persistence is critical.

---

## Phase 9: Teardown

To delete everything and stop costs:

```bash
cd terraform
terraform destroy
```
