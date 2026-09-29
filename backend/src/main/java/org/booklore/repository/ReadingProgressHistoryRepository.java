package org.booklore.repository;

import jakarta.persistence.QueryHint;
import org.booklore.model.dto.PagesReadSessionDto;
import org.booklore.model.entity.ReadingProgressHistoryEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.stream.Stream;

@Repository
public interface ReadingProgressHistoryRepository extends JpaRepository<ReadingProgressHistoryEntity, Long> {

    @QueryHints(@QueryHint(name = "org.hibernate.fetchSize", value = "200"))
    @Query("""
            SELECT
                b.id as bookId,
                h.recordedAt as startTime,
                h.progressDelta as progressDelta,
                bm.pageCount as pageCount
            FROM ReadingProgressHistoryEntity h
            JOIN h.book b
            JOIN b.metadata bm
            WHERE h.user.id = :userId
            AND h.progressDelta > 0
            AND bm.pageCount > 0
            AND h.recordedAt >= :periodStart AND h.recordedAt < :periodEnd
            ORDER BY h.recordedAt
            """)
    Stream<PagesReadSessionDto> findPagesReadByUserAndPeriod(
            @Param("userId") Long userId,
            @Param("periodStart") Instant periodStart,
            @Param("periodEnd") Instant periodEnd);
}
