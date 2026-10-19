-- Every notification we attempt, with its outcome. Rendering data is kept only
-- until the message is sent (or gives up) so links in it can't be replayed later.
CREATE TABLE deliveries (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id             uuid,
    event                text        NOT NULL,
    channel              text        NOT NULL DEFAULT 'email',
    template             text        NOT NULL,
    user_id              text,
    to_address           text        NOT NULL,
    subject              text,
    status               text        NOT NULL DEFAULT 'queued'
                         CHECK (status IN ('queued', 'retrying', 'sent', 'failed', 'skipped')),
    attempts             integer     NOT NULL DEFAULT 0,
    last_error           text,
    provider_message_id  text,
    payload              jsonb,
    correlation_id       text,
    next_attempt_at      timestamptz NOT NULL DEFAULT now(),
    created_at           timestamptz NOT NULL DEFAULT now(),
    sent_at              timestamptz,
    UNIQUE (event_id, channel, template)
);
CREATE INDEX deliveries_status_idx ON deliveries (status, next_attempt_at);
CREATE INDEX deliveries_created_idx ON deliveries (created_at DESC);

-- Devices a user has signed in from, for "new sign-in" alerts.
CREATE TABLE known_devices (
    user_id      text        NOT NULL,
    fingerprint  text        NOT NULL,
    label        text,
    first_seen   timestamptz NOT NULL DEFAULT now(),
    last_seen    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, fingerprint)
);
