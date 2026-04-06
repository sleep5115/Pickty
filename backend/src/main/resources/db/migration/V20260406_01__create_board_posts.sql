create table if not exists board_posts (
    id uuid primary key,
    title varchar(200) not null,
    content_html text not null,
    author_id bigint null,
    guest_nickname varchar(64) null,
    guest_password_hash varchar(255) null,
    guest_ip_hash varchar(64) null,
    guest_ip_prefix varchar(16) null,
    view_count bigint not null default 0,
    status varchar(20) not null default 'ACTIVE',
    created_at timestamp not null,
    updated_at timestamp not null,
    constraint ck_board_posts_author_or_guest
        check (
            (author_id is not null and guest_nickname is null and guest_password_hash is null and guest_ip_hash is null)
            or
            (author_id is null and guest_nickname is not null and guest_password_hash is not null and guest_ip_hash is not null and guest_ip_prefix is not null)
        )
);

create index if not exists ix_board_posts_status_created_at on board_posts(status, created_at desc);
create index if not exists ix_board_posts_author_id on board_posts(author_id);
