package com.flowforge.service;

import com.flowforge.model.Board;
import com.flowforge.model.BoardMember;
import com.flowforge.model.Task;
import com.flowforge.model.User;
import com.flowforge.repo.BoardMemberRepository;
import com.flowforge.repo.BoardRepository;
import com.flowforge.repo.TaskRepository;
import com.flowforge.repo.UserRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class BoardService {

    private final BoardRepository boardRepository;
    private final BoardMemberRepository memberRepository;
    private final UserRepository userRepository;
    private final TaskRepository taskRepository;

    public BoardService(
            BoardRepository boardRepository,
            BoardMemberRepository memberRepository,
            UserRepository userRepository,
            TaskRepository taskRepository) {

        this.boardRepository = boardRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
        this.taskRepository = taskRepository;
    }

    public Board createBoard(User owner, String name) {

        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException(
                    "Board name cannot be empty"
            );
        }

        Board board = new Board(
                name.trim(),
                owner
        );

        Board saved = boardRepository.save(board);

        BoardMember ownerMember =
                new BoardMember(
                        saved,
                        owner,
                        "OWNER"
                );

        memberRepository.save(ownerMember);

        return saved;
    }

    public List<Board> getMyBoards(User user) {

        return memberRepository
                .findByUser(user)
                .stream()
                .map(BoardMember::getBoard)
                .toList();
    }

    public Board getBoardForUser(
            Long boardId,
            User user) {

        Board board = boardRepository
                .findById(boardId)
                .orElseThrow(() ->
                        new RuntimeException("Board not found")
                );

        if (!memberRepository.existsByBoardAndUser(
                board,
                user)) {

            throw new RuntimeException(
                    "You do not have access to this board"
            );
        }

        return board;
    }

    public BoardMember addMember(
            Long boardId,
            String email,
            User currentUser) {

        Board board = getBoardForUser(
                boardId,
                currentUser
        );

        BoardMember currentMembership =
                memberRepository
                        .findByBoardAndUser(
                                board,
                                currentUser
                        )
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "You are not a board member"
                                )
                        );

        if (!"OWNER".equals(currentMembership.getRole())) {
            throw new RuntimeException(
                    "Only the board owner can add members"
            );
        }

        User user = userRepository
                .findByEmail(email.trim().toLowerCase())
                .orElseThrow(() ->
                        new RuntimeException(
                                "No FlowForge account exists with this email"
                        )
                );

        if (memberRepository.existsByBoardAndUser(
                board,
                user)) {

            throw new RuntimeException(
                    "User is already a member of this board"
            );
        }

        BoardMember member =
                new BoardMember(
                        board,
                        user,
                        "MEMBER"
                );

        return memberRepository.save(member);
    }

    public List<BoardMember> getMembers(
            Long boardId,
            User user) {

        Board board = getBoardForUser(
                boardId,
                user
        );

        return memberRepository
                .findByBoardOrderByJoinedAtAsc(board);
    }

    // ============================================================
    // OWNER — REMOVE MEMBER
    // ============================================================

    @Transactional
    public BoardMember removeMember(
            Long boardId,
            Long memberId,
            User currentUser) {

        Board board = boardRepository
                .findById(boardId)
                .orElseThrow(() ->
                        new RuntimeException("Board not found")
                );

        BoardMember currentMembership =
                memberRepository
                        .findByBoardAndUser(
                                board,
                                currentUser
                        )
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "You are not a member of this board"
                                )
                        );

        if (!"OWNER".equals(currentMembership.getRole())) {
            throw new RuntimeException(
                    "Only the board owner can remove members"
            );
        }

        BoardMember memberToRemove =
                memberRepository
                        .findById(memberId)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Board member not found"
                                )
                        );

        if (!memberToRemove.getBoard()
                .getId()
                .equals(board.getId())) {

            throw new RuntimeException(
                    "This member does not belong to this board"
            );
        }

        if ("OWNER".equals(memberToRemove.getRole())) {
            throw new RuntimeException(
                    "The board owner cannot be removed"
            );
        }

        memberRepository.delete(memberToRemove);

return memberToRemove;
    }

    // ============================================================
    // OWNER — DELETE BOARD
    // ============================================================

    @Transactional
    public void deleteBoard(
            Long boardId,
            User currentUser) {

        Board board = boardRepository
                .findById(boardId)
                .orElseThrow(() ->
                        new RuntimeException("Board not found")
                );

        if (!board.getOwner()
                .getId()
                .equals(currentUser.getId())) {

            throw new RuntimeException(
                    "Only the board owner can delete this board"
            );
        }

        // Delete tasks belonging to this board first.
        List<Task> tasks =
                taskRepository
                        .findByBoardOrderByPositionAsc(board);

        if (!tasks.isEmpty()) {
            taskRepository.deleteAll(tasks);
        }

        // Delete all board memberships.
        List<BoardMember> members =
                memberRepository
                        .findByBoardOrderByJoinedAtAsc(board);

        if (!members.isEmpty()) {
            memberRepository.deleteAll(members);
        }

        // Finally delete the board.
        boardRepository.delete(board);
    }
}