package org.booklore.model.dto;

import java.time.Instant;

public interface PagesReadSessionDto {
    Long getBookId();
    Instant getStartTime();
    Float getProgressDelta();
    Integer getPageCount();
}
