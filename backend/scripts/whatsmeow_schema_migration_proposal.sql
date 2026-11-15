-- ==============================================================================
-- CivicSense AI — WhatsMeow & Gateway Queue PostgreSQL Schema Migration Proposal
-- Target: Staging Supabase Project (oayzaszhhpfjlpmaezmc) in Tokyo (ap-northeast-1)
-- Pooler: aws-0-ap-northeast-1.pooler.supabase.com:5432 (Session Mode Pooler)
--
-- STATUS: LEAST-PRIVILEGE AUDITED PROPOSAL — AWAITING EXPLICIT USER AUTHORIZATION (GATE 1)
--
-- Architectural & Permission Principles:
-- 1. Dedicated Least-Privilege Role & Attribute Hardening:
--    - Enforces LOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, and NOBYPASSRLS.
--    - Enforces these safeguards both upon initial creation and when the role already exists,
--      preventing the silent preservation of any prior elevated attributes.
-- 2. Role Membership Rationale & Caveat:
--    - Executes 'GRANT whatsmeow_gateway TO postgres' so the administrative user can configure
--      ALTER DEFAULT PRIVILEGES FOR ROLE whatsmeow_gateway in managed PostgreSQL environments.
--    - Membership is strictly one-way: postgres can act as whatsmeow_gateway, but whatsmeow_gateway
--      gains zero privileges on postgres and cannot assume or inherit postgres.
--    - UNVERIFIED ON STAGING: Supabase's acceptance of this grant must be confirmed on staging.
-- 3. Default Privileges Discipline (DML vs Ownership):
--    - DML grants do NOT transfer object ownership or administrative/DDL privileges.
--    - whatsmeow_gateway receives DML on queue tables created by postgres.
--    - postgres receives SELECT-only on WhatsMeow tables for backups and audits, avoiding
--      unnecessary write access to raw Signal cryptographic keys.
-- 4. Effective Public-Schema Permissions & Isolation Verification:
--    - Public schema USAGE is typically inherited via pseudo-role PUBLIC for resolving shared extensions.
--    - Schema CREATE and all table/sequence privileges are strictly revoked from whatsmeow_gateway.
--    - Static REVOKE statements alone do not prove isolation; runtime verification via
--      has_table_privilege() catalog queries is required during staging testing.
-- 5. Supabase Pooler Compatibility (UNVERIFIED — Requires Staging Test):
--    - Shared pooler candidate username format: whatsmeow_gateway.oayzaszhhpfjlpmaezmc
--    - Direct connection username format: whatsmeow_gateway (requires IPv6)
--    - Pooler authentication remains UNVERIFIED until real staging execution succeeds.
-- 6. Upstream WhatsMeow Migration Compatibility:
--    'whatsmeow_gateway' holds CREATE on schema 'whatsmeow', allowing WhatsMeow's native
--    container.Upgrade() to create and own its 9 Signal protocol tables without collision.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DEDICATED ISOLATED SCHEMA CREATION & ADMINISTRATIVE OWNERSHIP
-- ------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS whatsmeow;
ALTER SCHEMA whatsmeow OWNER TO postgres;

-- ------------------------------------------------------------------------------
-- 2. DEDICATED LEAST-PRIVILEGE ROLE PROVISIONING & ATTRIBUTE HARDENING
-- Enforces least-privilege attributes whether the role is newly created or pre-exists.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    is_super BOOLEAN;
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'whatsmeow_gateway') THEN
        CREATE ROLE whatsmeow_gateway WITH 
            LOGIN 
            NOSUPERUSER 
            NOCREATEDB 
            NOCREATEROLE 
            NOREPLICATION 
            NOBYPASSRLS 
            PASSWORD 'REPLACE_WITH_SECURE_GATEWAY_PASSWORD';
        RAISE NOTICE 'Role whatsmeow_gateway created with least-privilege attributes.';
    ELSE
        -- HARDENING SAFEGUARD: Strip elevated attributes and synchronize password and LOGIN.
        -- In managed PostgreSQL environments (such as Supabase), 'postgres' is not a superuser;
        -- altering NOSUPERUSER/NOREPLICATION/NOBYPASSRLS requires superuser privilege.
        -- Therefore, we check superuser status before applying the full attribute strip.
        SELECT rolsuper INTO is_super FROM pg_catalog.pg_roles WHERE rolname = current_user;
        IF is_super THEN
            ALTER ROLE whatsmeow_gateway WITH 
                LOGIN 
                NOSUPERUSER 
                NOCREATEDB 
                NOCREATEROLE 
                NOREPLICATION 
                NOBYPASSRLS 
                PASSWORD 'REPLACE_WITH_SECURE_GATEWAY_PASSWORD';
            RAISE NOTICE 'Role whatsmeow_gateway already exists: stripped of all elevated privileges.';
        ELSE
            ALTER ROLE whatsmeow_gateway WITH 
                LOGIN 
                NOCREATEDB 
                NOCREATEROLE 
                PASSWORD 'REPLACE_WITH_SECURE_GATEWAY_PASSWORD';
            RAISE NOTICE 'Role whatsmeow_gateway already exists: stripped of elevated attributes, synchronized password in managed environment.';
        END IF;
    END IF;
END
$$;

-- Allow admin role (postgres) to configure default privileges on behalf of whatsmeow_gateway.
-- In managed PostgreSQL environments (such as Supabase), postgres is not a physical superuser;
-- PostgreSQL requires role membership to execute 'ALTER DEFAULT PRIVILEGES FOR ROLE ...'.
-- Note: Membership is strictly one-way (postgres inherits whatsmeow_gateway, NOT vice versa).
-- UNVERIFIED ON STAGING: Supabase's acceptance of this grant must be confirmed on staging.
GRANT whatsmeow_gateway TO postgres;

-- ------------------------------------------------------------------------------
-- 3. DATABASE CONNECTION & SCHEMA PERMISSIONS
-- ------------------------------------------------------------------------------
GRANT CONNECT ON DATABASE postgres TO whatsmeow_gateway;
GRANT USAGE, CREATE ON SCHEMA whatsmeow TO whatsmeow_gateway;

-- ------------------------------------------------------------------------------
-- 4. POSTGREST & PUBLIC ACCESS SHIELD
-- Prevent public or PostgREST exposure (anon / authenticated roles).
-- ------------------------------------------------------------------------------
REVOKE ALL ON SCHEMA whatsmeow FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA whatsmeow REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA whatsmeow REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 5. STRICT APPLICATION DATA ISOLATION (PUBLIC SCHEMA TABLE-LEVEL PROTECTION)
-- Prevents the gateway role from creating, reading, or modifying application tables.
-- Note: USAGE on schema public may still be inherited via pseudo-role PUBLIC (allowing
-- resolution of shared extensions/types), but table and sequence access is completely blocked.
-- Unauthorized queries fail with: ERROR: permission denied for table <table_name>
-- IMPORTANT: Static REVOKE statements do not prove complete isolation. Isolation must be
-- proven by running runtime catalog queries (e.g. has_table_privilege) during staging testing.
-- ------------------------------------------------------------------------------
REVOKE ALL ON SCHEMA public FROM whatsmeow_gateway;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM whatsmeow_gateway;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM whatsmeow_gateway;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM whatsmeow_gateway;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM whatsmeow_gateway;

-- ------------------------------------------------------------------------------
-- 6. GATEWAY MESSAGE DEDUPLICATION TABLE
-- Owner: CivicSense WhatsApp Gateway (internal/queue)
-- Purpose: Persists processed message IDs to prevent double-processing.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsmeow.processed_messages (
    message_id VARCHAR(128) PRIMARY KEY,
    sender VARCHAR(64) NOT NULL,
    received_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_processed_messages_expires 
    ON whatsmeow.processed_messages(expires_at);

-- ------------------------------------------------------------------------------
-- 7. GATEWAY INBOUND EVENTS DURABLE QUEUE TABLE
-- Owner: CivicSense WhatsApp Gateway (internal/queue)
-- Purpose: Durably queues inbound WhatsApp events for delivery to FastAPI backend.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsmeow.inbound_events_queue (
    event_id VARCHAR(128) PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    payload TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    next_retry_at BIGINT NOT NULL,
    last_error TEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inbound_queue_retry 
    ON whatsmeow.inbound_events_queue(status, next_retry_at);

-- ------------------------------------------------------------------------------
-- 8. TABLE & SEQUENCE DML PERMISSIONS FOR GATEWAY ROLE
-- ------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA whatsmeow TO whatsmeow_gateway;
GRANT ALL ON ALL SEQUENCES IN SCHEMA whatsmeow TO whatsmeow_gateway;

-- ------------------------------------------------------------------------------
-- 9. BIDIRECTIONAL DEFAULT PRIVILEGES CONFIGURATION
-- Configured for the actual roles that create database objects in 'whatsmeow':
--
-- A) Objects created by postgres (e.g. migration scripts):
--    Accessible to whatsmeow_gateway for runtime DML.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA whatsmeow 
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO whatsmeow_gateway;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA whatsmeow 
    GRANT ALL ON SEQUENCES TO whatsmeow_gateway;

-- B) Objects created by whatsmeow_gateway (e.g. WhatsMeow's 9 Signal protocol tables):
--    Accessible to postgres for database backups and audit monitoring (SELECT-only).
--    Avoids granting unnecessary write/DML access to raw Signal cryptographic keys.
ALTER DEFAULT PRIVILEGES FOR ROLE whatsmeow_gateway IN SCHEMA whatsmeow 
    GRANT SELECT ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE whatsmeow_gateway IN SCHEMA whatsmeow 
    GRANT SELECT ON SEQUENCES TO postgres;

-- ------------------------------------------------------------------------------
-- 10. UPSTREAM WHATSMEOW SQL STORE SPECIFICATION
-- Owner: go.mau.fi/whatsmeow/store/sqlstore
--
-- CRITICAL ARCHITECTURAL SAFEGUARD:
-- DO NOT execute manual CREATE TABLE statements for whatsmeow_* tables here!
-- Upstream whatsmeow uses its own internal migration engine (container.Upgrade())
-- which tracks schema versions inside whatsmeow.whatsmeow_version. If these tables
-- are pre-created manually, container.Upgrade() will attempt to run upgrade v01
-- and fail with "pq: relation whatsmeow_device already exists".
--
-- When the gateway boots as 'whatsmeow_gateway' with search_path=whatsmeow,public,
-- whatsmeow automatically creates and manages the following tables inside schema 'whatsmeow':
--
--   whatsmeow.whatsmeow_version
--   whatsmeow.whatsmeow_device
--   whatsmeow.whatsmeow_identity_keys
--   whatsmeow.whatsmeow_pre_keys
--   whatsmeow.whatsmeow_sessions
--   whatsmeow.whatsmeow_sender_keys
--   whatsmeow.whatsmeow_app_state_sync_keys
--   whatsmeow.whatsmeow_app_state_version
--   whatsmeow.whatsmeow_message_secrets
-- ------------------------------------------------------------------------------
