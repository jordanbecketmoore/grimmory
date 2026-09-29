package org.booklore.service;

import org.booklore.config.security.service.AuthenticationService;
import org.booklore.model.dto.BookLoreUser;
import org.booklore.model.dto.PagesReadSessionDto;
import org.booklore.model.dto.response.PagesPerDayResponse;
import org.booklore.repository.BookRepository;
import org.booklore.repository.ReadingProgressHistoryRepository;
import org.booklore.repository.ReadingSessionRepository;
import org.booklore.repository.UserBookProgressRepository;
import org.booklore.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReadingSessionServiceTest {

    @Mock
    private AuthenticationService authenticationService;
    @Mock
    private ReadingSessionRepository readingSessionRepository;
    @Mock
    private BookRepository bookRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private UserBookProgressRepository userBookProgressRepository;
    @Mock
    private ReadingProgressHistoryRepository readingProgressHistoryRepository;

    @InjectMocks
    private ReadingSessionService readingSessionService;

    private record Session(Long bookId, Instant startTime, Float progressDelta, Integer pageCount) implements PagesReadSessionDto {
        @Override public Long getBookId() { return bookId; }
        @Override public Instant getStartTime() { return startTime; }
        @Override public Float getProgressDelta() { return progressDelta; }
        @Override public Integer getPageCount() { return pageCount; }
    }

    @BeforeEach
    void setUp() {
        when(authenticationService.getAuthenticatedUser()).thenReturn(BookLoreUser.builder().id(1L).build());
    }

    private static Instant at(LocalDate date, int hour) {
        return date.atStartOfDay(ZoneId.systemDefault()).plusHours(hour).toInstant();
    }

    private void givenSessions(Session... sessions) {
        givenSessionsAndSyncedProgress(sessions, new Session[0]);
    }

    private void givenSessionsAndSyncedProgress(Session[] sessions, Session[] synced) {
        when(readingSessionRepository.findPagesReadSessionsByUserAndPeriod(eq(1L), any(Instant.class), any(Instant.class)))
                .thenReturn(Stream.of(sessions));
        when(readingProgressHistoryRepository.findPagesReadByUserAndPeriod(eq(1L), any(Instant.class), any(Instant.class)))
                .thenReturn(Stream.of(synced));
    }

    @Test
    void getPagesPerDay_sumsPagesAcrossBooksOnTheSameDay() {
        LocalDate day = LocalDate.of(2026, 3, 14);
        givenSessions(
                new Session(10L, at(day, 9), 10f, 300),
                new Session(10L, at(day, 20), 5f, 300),
                new Session(20L, at(day, 21), 25f, 200)
        );

        List<PagesPerDayResponse> result = readingSessionService.getPagesPerDay(2026);

        assertEquals(1, result.size());
        assertEquals(day, result.getFirst().getDate());
        assertEquals(95, result.getFirst().getPagesRead());
        assertEquals(2, result.getFirst().getBookCount());
    }

    @Test
    void getPagesPerDay_clampsDeltaToWholeBook() {
        LocalDate day = LocalDate.of(2026, 5, 1);
        givenSessions(new Session(10L, at(day, 12), 150f, 400));

        List<PagesPerDayResponse> result = readingSessionService.getPagesPerDay(2026);

        assertEquals(400, result.getFirst().getPagesRead());
    }

    @Test
    void getPagesPerDay_roundsPagesAndDropsDaysThatRoundToZero() {
        LocalDate readingDay = LocalDate.of(2026, 6, 2);
        LocalDate trivialDay = LocalDate.of(2026, 6, 3);
        givenSessions(
                new Session(10L, at(readingDay, 12), 3.3f, 250),
                new Session(10L, at(trivialDay, 12), 0.1f, 250)
        );

        List<PagesPerDayResponse> result = readingSessionService.getPagesPerDay(2026);

        assertEquals(1, result.size());
        assertEquals(readingDay, result.getFirst().getDate());
        assertEquals(8, result.getFirst().getPagesRead());
    }

    @Test
    void getPagesPerDay_returnsDaysInChronologicalOrder() {
        LocalDate later = LocalDate.of(2026, 8, 20);
        LocalDate earlier = LocalDate.of(2026, 2, 5);
        givenSessions(
                new Session(10L, at(later, 12), 10f, 100),
                new Session(20L, at(earlier, 12), 10f, 100)
        );

        List<PagesPerDayResponse> result = readingSessionService.getPagesPerDay(2026);

        assertEquals(List.of(earlier, later), result.stream().map(PagesPerDayResponse::getDate).toList());
        assertTrue(result.stream().allMatch(r -> r.getBookCount() == 1));
    }

    @Test
    void getPagesPerDay_includesProgressSyncedFromKoreader() {
        LocalDate day = LocalDate.of(2026, 4, 10);
        givenSessionsAndSyncedProgress(
                new Session[]{new Session(10L, at(day, 9), 10f, 300)},
                new Session[]{new Session(20L, at(day, 22), 20f, 250)}
        );

        List<PagesPerDayResponse> result = readingSessionService.getPagesPerDay(2026);

        assertEquals(1, result.size());
        assertEquals(80, result.getFirst().getPagesRead());
        assertEquals(2, result.getFirst().getBookCount());
    }
}
