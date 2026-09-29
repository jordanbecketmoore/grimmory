CREATE TABLE IF NOT EXISTS reading_progress_history
(
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id        BIGINT      NOT NULL,
    book_id        BIGINT      NOT NULL,
    source         VARCHAR(20) NOT NULL,
    start_progress FLOAT       NOT NULL,
    end_progress   FLOAT       NOT NULL,
    progress_delta FLOAT       NOT NULL,
    recorded_at    DATETIME    NOT NULL,
    CONSTRAINT fk_reading_progress_history_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_reading_progress_history_book FOREIGN KEY (book_id) REFERENCES book (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reading_progress_history_user_time ON reading_progress_history (user_id, recorded_at);
