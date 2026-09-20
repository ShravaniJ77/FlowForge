package com.flowforge.service;

import com.flowforge.model.Board;
import com.flowforge.model.Task;
import com.flowforge.repo.TaskRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class AutoFlowService {

    private final TaskRepository repo;

    public AutoFlowService(TaskRepository repo) {
        this.repo = repo;
    }

    public AutoFlowResult analyze(Board board) {

        List<TaskRecommendation> recommendations =
                new ArrayList<>();

        List<Task> allTasks =
                repo.findByBoardOrderByPositionAsc(board);

        for (Task task : allTasks) {

            // Completed tasks are not candidates
            if ("DONE".equals(task.getStatus())) {
                continue;
            }

            // Blocked tasks are not candidates
            if (isBlocked(task)) {
                continue;
            }

            recommendations.add(
                    calculateRecommendation(task)
            );
        }

        recommendations.sort(
                Comparator
                        .comparingInt(
                                TaskRecommendation::score
                        )
                        .reversed()
                        .thenComparing(
                                TaskRecommendation::title
                        )
        );

        TaskRecommendation topTask =
                recommendations.isEmpty()
                        ? null
                        : recommendations.get(0);

        return new AutoFlowResult(
                topTask,
                recommendations
        );
    }

    // =========================================================
    // CALCULATE RECOMMENDATION
    // =========================================================

    private TaskRecommendation calculateRecommendation(
            Task task) {

        int priorityScore =
                calculatePriorityScore(task);

        int deadlineScore =
                calculateDeadlineScore(task);

        int effortScore =
                calculateEffortScore(task);

        int statusScore =
                calculateStatusScore(task);

        int dependencyScore =
                calculateDependencyScore(task);

        int totalScore =
                priorityScore
                        + deadlineScore
                        + effortScore
                        + statusScore
                        + dependencyScore;

        List<String> reasons =
                new ArrayList<>();

        addPriorityReason(
                task,
                reasons
        );

        addDeadlineReason(
                task,
                reasons
        );

        addEffortReason(
                task,
                reasons
        );

        addDependencyReason(
                task,
                reasons
        );

        if ("IN_PROGRESS".equals(task.getStatus())) {
            reasons.add("Already in progress");
        }

        return new TaskRecommendation(
                task.getId(),
                task.getTitle(),
                task.getStatus(),
                task.getPriority(),
                task.getDueDate(),
                task.getEstimatedMinutes(),
                totalScore,
                reasons
        );
    }

    // =========================================================
    // PRIORITY
    // =========================================================

    private int calculatePriorityScore(Task task) {

        if ("HIGH".equalsIgnoreCase(
                task.getPriority())) {

            return 30;
        }

        if ("MEDIUM".equalsIgnoreCase(
                task.getPriority())) {

            return 20;
        }

        return 10;
    }

    // =========================================================
    // DEADLINE
    // =========================================================

    private int calculateDeadlineScore(Task task) {

        if (task.getDueDate() == null) {
            return 0;
        }

        LocalDate today =
                LocalDate.now();

        long daysUntilDue =
                ChronoUnit.DAYS.between(
                        today,
                        task.getDueDate()
                );

        if (daysUntilDue < 0) {
            return 35;
        }

        if (daysUntilDue == 0) {
            return 35;
        }

        if (daysUntilDue <= 2) {
            return 30;
        }

        if (daysUntilDue <= 7) {
            return 24;
        }

        if (daysUntilDue <= 14) {
            return 18;
        }

        if (daysUntilDue <= 30) {
            return 10;
        }

        return 5;
    }

    // =========================================================
    // EFFORT
    // =========================================================

    private int calculateEffortScore(Task task) {

        Integer minutes =
                task.getEstimatedMinutes();

        if (minutes == null) {
            return 0;
        }

        if (minutes <= 30) {
            return 15;
        }

        if (minutes <= 60) {
            return 12;
        }

        if (minutes <= 120) {
            return 9;
        }

        if (minutes <= 240) {
            return 6;
        }

        return 3;
    }

    // =========================================================
    // STATUS
    // =========================================================

    private int calculateStatusScore(Task task) {

        if ("IN_PROGRESS".equals(
                task.getStatus())) {

            return 10;
        }

        return 5;
    }

    // =========================================================
    // DEPENDENCY
    // =========================================================

    private int calculateDependencyScore(Task task) {

        if (task.getDependsOn() == null) {
            return 0;
        }

        if ("DONE".equals(
                task.getDependsOn().getStatus())) {

            return 10;
        }

        return 0;
    }

    // =========================================================
    // BLOCKED
    // =========================================================

    private boolean isBlocked(Task task) {

        return task.getDependsOn() != null
                && !"DONE".equals(
                        task
                                .getDependsOn()
                                .getStatus()
                );
    }

    // =========================================================
    // REASONS
    // =========================================================

    private void addPriorityReason(
            Task task,
            List<String> reasons) {

        if ("HIGH".equalsIgnoreCase(
                task.getPriority())) {

            reasons.add("High priority");

        } else if ("MEDIUM".equalsIgnoreCase(
                task.getPriority())) {

            reasons.add("Medium priority");
        }
    }

    private void addDeadlineReason(
            Task task,
            List<String> reasons) {

        if (task.getDueDate() == null) {
            return;
        }

        LocalDate today =
                LocalDate.now();

        long days =
                ChronoUnit.DAYS.between(
                        today,
                        task.getDueDate()
                );

        if (days < 0) {

            reasons.add(
                    "Deadline has passed"
            );

        } else if (days == 0) {

            reasons.add(
                    "Due today"
            );

        } else if (days == 1) {

            reasons.add(
                    "Due tomorrow"
            );

        } else if (days <= 7) {

            reasons.add(
                    "Due within a week"
            );
        }
    }

    private void addEffortReason(
            Task task,
            List<String> reasons) {

        if (task.getEstimatedMinutes() != null
                && task.getEstimatedMinutes() <= 60) {

            reasons.add(
                    "Can be completed relatively quickly"
            );
        }
    }

    private void addDependencyReason(
            Task task,
            List<String> reasons) {

        if (task.getDependsOn() != null
                && "DONE".equals(
                        task
                                .getDependsOn()
                                .getStatus())) {

            reasons.add(
                    "Dependency is completed"
            );
        }
    }

    // =========================================================
    // RESPONSE RECORDS
    // =========================================================

    public record AutoFlowResult(
            TaskRecommendation recommendation,
            List<TaskRecommendation> rankedTasks
    ) {}

    public record TaskRecommendation(
            Long id,
            String title,
            String status,
            String priority,
            LocalDate dueDate,
            Integer estimatedMinutes,
            int score,
            List<String> reasons
    ) {}
}