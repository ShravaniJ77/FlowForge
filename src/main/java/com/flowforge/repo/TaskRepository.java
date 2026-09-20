package com.flowforge.repo;

import com.flowforge.model.Board;
import com.flowforge.model.Task;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TaskRepository extends JpaRepository<Task, Long> {

    List<Task> findAllByOrderByPositionAsc();

    List<Task> findByBoardOrderByPositionAsc(Board board);

    List<Task> findByBoardIsNullOrderByPositionAsc();
}