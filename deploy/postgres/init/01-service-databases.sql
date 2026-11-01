-- Database-per-service: each service owns its schema and cannot read the others'.
CREATE ROLE auth_svc LOGIN PASSWORD 'auth_dev';
CREATE DATABASE auth OWNER auth_svc;

CREATE ROLE marketplace_svc LOGIN PASSWORD 'marketplace_dev';
CREATE DATABASE marketplace OWNER marketplace_svc;

CREATE ROLE community_svc LOGIN PASSWORD 'community_dev';
CREATE DATABASE community OWNER community_svc;

CREATE ROLE usage_svc LOGIN PASSWORD 'usage_dev';
CREATE DATABASE usage OWNER usage_svc;

REVOKE CONNECT ON DATABASE auth, marketplace, community, usage FROM PUBLIC;
GRANT CONNECT ON DATABASE auth TO auth_svc;
GRANT CONNECT ON DATABASE marketplace TO marketplace_svc;
GRANT CONNECT ON DATABASE community TO community_svc;
GRANT CONNECT ON DATABASE usage TO usage_svc;
