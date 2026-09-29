package org.booklore.model.entity;

import jakarta.persistence.*;
import lombok.*;
import org.booklore.model.enums.ReadingProgressSource;

import java.time.Instant;

/**
 * Forward progress reported by an external sync source (e.g. KOReader). These syncs carry no
 * session timing, so they are kept apart from {@link ReadingSessionEntity} and only feed
 * progress-based stats such as pages read per day.
 */
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "reading_progress_history")
public class ReadingProgressHistoryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private BookLoreUserEntity user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "book_id", nullable = false)
    private BookEntity book;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, length = 20)
    private ReadingProgressSource source;

    @Column(name = "start_progress", nullable = false)
    private Float startProgress;

    @Column(name = "end_progress", nullable = false)
    private Float endProgress;

    @Column(name = "progress_delta", nullable = false)
    private Float progressDelta;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;
}
