package com.flowforge.repo;

import com.flowforge.model.Board;
import com.flowforge.model.BoardMember;
import com.flowforge.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BoardMemberRepository
        extends JpaRepository<BoardMember, Long> {

    List<BoardMember> findByBoardOrderByJoinedAtAsc(Board board);

    Optional<BoardMember> findByBoardAndUser(
            Board board,
            User user
    );

    boolean existsByBoardAndUser(
            Board board,
            User user
    );

    List<BoardMember> findByUser(User user);
}