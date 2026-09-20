package com.flowforge.service;

import com.flowforge.model.Board;
import com.flowforge.model.Task;
import com.flowforge.repo.TaskRepository;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class TaskService {

    private final TaskRepository repo;

    public TaskService(TaskRepository repo) {
        this.repo = repo;
    }

    public List<Task> all(Board board) {
        return repo.findByBoardOrderByPositionAsc(board);
    }

    public Task findById(Long id) {
        return repo.findById(id)
                .orElseThrow(() ->
                        new RuntimeException("Task not found"));
    }

    public Task findByIdForBoard(Long id, Board board) {

        Task task = findById(id);

        if (task.getBoard() == null
                || !task.getBoard().getId().equals(board.getId())) {

            throw new RuntimeException(
                    "Task does not belong to this board"
            );
        }

        return task;
    }

    public Task create(Task task, Board board) {

        validateTask(task);

        task.setBoard(board);

        if (task.getDependsOn() != null) {

            Long dependencyId =
                    task.getDependsOn().getId();

            if (dependencyId == null) {
                throw new IllegalArgumentException(
                        "Invalid dependency");
            }

            Task dependency =
                    findByIdForBoard(dependencyId, board);

            task.setDependsOn(dependency);
        }

        return repo.save(task);
    }

    public Task move(
            Long id,
            Board board,
            String status,
            Integer position) {

        Task task =
                findByIdForBoard(id, board);

        if (!isValidStatus(status)) {
            throw new IllegalArgumentException(
                    "Invalid task status");
        }

        if ("DONE".equals(status)
                && task.getDependsOn() != null
                && !"DONE".equals(
                        task.getDependsOn().getStatus())) {

            throw new IllegalStateException(
                    "This task is blocked by an incomplete dependency."
            );
        }

        task.setStatus(status);

        task.setPosition(
                position == null
                        ? 0
                        : Math.max(position, 0)
        );

        return repo.save(task);
    }

    public Task update(
            Long id,
            Board board,
            Task updatedTask) {

        Task existingTask =
                findByIdForBoard(id, board);

        validateTask(updatedTask);

        if (updatedTask.getDependsOn() != null
                && updatedTask.getDependsOn().getId() != null) {

            Long dependencyId =
                    updatedTask.getDependsOn().getId();

            if (id.equals(dependencyId)) {

                throw new IllegalArgumentException(
                        "A task cannot depend on itself."
                );
            }

            Task dependency =
                    findByIdForBoard(
                            dependencyId,
                            board
                    );

            if (createsDependencyCycle(
                    existingTask,
                    dependency)) {

                throw new IllegalArgumentException(
                        "This dependency would create a circular task dependency."
                );
            }

            existingTask.setDependsOn(dependency);

        } else {

            existingTask.setDependsOn(null);
        }

        existingTask.setTitle(
                updatedTask.getTitle().trim()
        );

        existingTask.setDescription(
                updatedTask.getDescription()
        );

        existingTask.setPriority(
                updatedTask.getPriority()
        );

        if (updatedTask.getStatus() != null) {

            existingTask.setStatus(
                    updatedTask.getStatus()
            );
        }

        existingTask.setDueDate(
                updatedTask.getDueDate()
        );

        existingTask.setEstimatedMinutes(
                updatedTask.getEstimatedMinutes()
        );

        if ("DONE".equals(existingTask.getStatus())
                && existingTask.getDependsOn() != null
                && !"DONE".equals(
                        existingTask
                                .getDependsOn()
                                .getStatus())) {

            throw new IllegalStateException(
                    "This task is blocked by an incomplete dependency."
            );
        }

        return repo.save(existingTask);
    }

    public void delete(Long id, Board board) {

        Task task =
                findByIdForBoard(id, board);

        repo.delete(task);
    }

    private boolean createsDependencyCycle(
            Task currentTask,
            Task proposedDependency) {

        Set<Long> visited =
                new HashSet<>();

        Task current =
                proposedDependency;

        while (current != null) {

            if (current.getId() == null) {
                return false;
            }

            if (current.getId().equals(
                    currentTask.getId())) {

                return true;
            }

            if (!visited.add(
                    current.getId())) {

                return true;
            }

            current =
                    current.getDependsOn();
        }

        return false;
    }

    private void validateTask(Task task) {

        if (task.getTitle() == null
                || task.getTitle().trim().isEmpty()) {

            throw new IllegalArgumentException(
                    "Task title cannot be empty"
            );
        }

        if (task.getStatus() == null) {
            task.setStatus("TODO");
        }

        if (!isValidStatus(
                task.getStatus())) {

            throw new IllegalArgumentException(
                    "Invalid task status"
            );
        }

        if (task.getPriority() == null) {
            task.setPriority("MEDIUM");
        }

        if (!isValidPriority(
                task.getPriority())) {

            throw new IllegalArgumentException(
                    "Invalid task priority"
            );
        }

        if (task.getPosition() == null) {
            task.setPosition(0);
        }
    }

    private boolean isValidStatus(
            String status) {

        return "TODO".equals(status)
                || "IN_PROGRESS".equals(status)
                || "DONE".equals(status);
    }

    private boolean isValidPriority(
            String priority) {

        return "LOW".equals(priority)
                || "MEDIUM".equals(priority)
                || "HIGH".equals(priority);
    }
}