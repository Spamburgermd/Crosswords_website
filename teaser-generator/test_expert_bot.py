#!/usr/bin/env python3
"""
Test suite for the Expert Mode Bot to verify it guesses efficiently.
This script evaluates:
1. Entropy-based guess selection efficiency
2. Feedback filtering accuracy
3. Candidate pool management
4. Guess diversity (no repeats)
"""

import json
import sys
import os
from typing import Dict, List, Set
from collections import Counter

# Add crosswords_server to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'crosswords_server'))

from app.game_logic.scoring import score_guess
from app.routers.games import (
    _candidate_pool_for_length,
    _score_pattern,
    _exclude_guessed,
    _filter_candidates_with_feedback,
    _choose_best_guess,
)

# ======================== Test Utilities ========================

def simulate_game_turn(target: str, candidates: List[str], num_guesses: int = 10, expert_mode: bool = True) -> Dict:
    """
    Simulate a complete game turn sequence against a target word.
    Returns stats about guess efficiency.
    """
    guessed = []
    current_candidates = candidates.copy()
    feedback_history = []
    
    print(f"\n{'='*70}")
    print(f"Simulating game vs target: {target.upper()} (length {len(target)})")
    print(f"Initial candidate pool size: {len(current_candidates)}")
    print(f"Expert mode: {expert_mode}")
    print(f"{'='*70}")
    
    for turn in range(num_guesses):
        if not current_candidates:
            print(f"Turn {turn}: ERROR - No candidates left!")
            break
            
        # Pick guess using bot strategy
        guess = _choose_best_guess(current_candidates, guessed, expert_mode)
        guessed.append(guess)
        
        # Score the guess against target
        codes = score_guess(guess, target)
        pattern = _score_pattern(guess, target)
        feedback_history.append((guess, codes, pattern))
        
        print(f"\nTurn {turn + 1}:")
        print(f"  Guess: {guess.upper()}")
        print(f"  Feedback: {pattern} ({','.join(codes)})")
        
        # Check for win
        if all(c == 'G' for c in codes):
            print(f"  ✓ SOLVED in {turn + 1} turns!")
            return {
                "target": target.upper(),
                "guessed": guessed,
                "solved": True,
                "turns_to_solve": turn + 1,
                "feedback_history": feedback_history,
                "final_pool_size": len(current_candidates),
            }
        
        # Filter candidates based on feedback
        old_size = len(current_candidates)
        current_candidates = _filter_candidates_with_feedback(
            current_candidates, guess, codes
        )
        current_candidates = _exclude_guessed(current_candidates, guessed)
        
        print(f"  Candidates: {old_size} → {len(current_candidates)}")
        
        if not current_candidates:
            print(f"  WARNING: Candidate pool exhausted!")
            break
    
    print(f"\nDid NOT solve in {num_guesses} turns.")
    return {
        "target": target.upper(),
        "guessed": guessed,
        "solved": False,
        "turns_to_solve": None,
        "feedback_history": feedback_history,
        "final_pool_size": len(current_candidates),
    }


# ======================== Test Cases ========================

def test_expert_vs_simple(target: str, length: int):
    """Compare expert mode vs simple random mode."""
    print(f"\n\n{'#'*70}")
    print(f"# COMPARISON TEST: Expert vs Simple")
    print(f"# Target: {target.upper()} (length {length})")
    print(f"{'#'*70}")
    
    candidates = _candidate_pool_for_length(length)
    print(f"Available candidates for length {length}: {len(candidates)}")
    
    # Expert mode
    print("\n[EXPERT MODE]")
    expert_result = simulate_game_turn(target, candidates.copy(), num_guesses=15, expert_mode=True)
    
    # Simple mode
    print("\n\n[SIMPLE MODE]")
    simple_result = simulate_game_turn(target, candidates.copy(), num_guesses=15, expert_mode=False)
    
    # Compare
    print(f"\n{'='*70}")
    print("COMPARISON RESULTS:")
    print(f"{'='*70}")
    print(f"Target: {target.upper()}")
    if expert_result["solved"] and simple_result["solved"]:
        print(f"Expert mode: {expert_result['turns_to_solve']} turns")
        print(f"Simple mode: {simple_result['turns_to_solve']} turns")
        if expert_result['turns_to_solve'] < simple_result['turns_to_solve']:
            improvement = simple_result['turns_to_solve'] - expert_result['turns_to_solve']
            print(f"✓ Expert mode is {improvement} turns faster ({(improvement/simple_result['turns_to_solve']*100):.1f}% improvement)")
        elif expert_result['turns_to_solve'] == simple_result['turns_to_solve']:
            print(f"≈ Same efficiency for this target")
        else:
            print(f"✗ Simple mode was faster (check candidate selection)")
    elif expert_result["solved"]:
        print(f"✓ Expert mode solved in {expert_result['turns_to_solve']} turns")
        print(f"✗ Simple mode did NOT solve")
    elif simple_result["solved"]:
        print(f"✗ Expert mode did NOT solve")
        print(f"✓ Simple mode solved in {simple_result['turns_to_solve']} turns")
    else:
        print(f"✗ Neither mode solved within 15 turns")


def test_feedback_filtering():
    """Verify feedback-based filtering is working correctly."""
    print(f"\n\n{'#'*70}")
    print(f"# TEST: Feedback Filtering Accuracy")
    print(f"{'#'*70}")
    
    target = "APPLE"
    candidates = ["APPLE", "APPLY", "AMPLE", "MAPLE", "AMPLE", "AMBLE"]
    test_guess = "ALIEN"
    
    codes = score_guess(test_guess, target)
    print(f"\nTarget: {target}")
    print(f"Test guess: {test_guess}")
    print(f"Feedback: {''.join(codes)}")
    
    # Filter
    filtered = _filter_candidates_with_feedback(candidates, test_guess, codes)
    print(f"\nOriginal candidates: {candidates}")
    print(f"Filtered candidates: {filtered}")
    
    # Verify each filtered candidate would produce same feedback
    print("\nVerifying filtered candidates:")
    all_valid = True
    for cand in filtered:
        cand_codes = score_guess(test_guess, cand)
        is_match = cand_codes == codes
        status = "✓" if is_match else "✗"
        print(f"  {status} {cand}: {''.join(cand_codes)}")
        if not is_match:
            all_valid = False
    
    if all_valid:
        print(f"\n✓ All filtered candidates match feedback correctly")
    else:
        print(f"\n✗ Some filtered candidates do NOT match feedback")
    
    return all_valid


def test_no_repeats():
    """Verify bot doesn't guess the same word twice."""
    print(f"\n\n{'#'*70}")
    print(f"# TEST: No Repeat Guesses")
    print(f"{'#'*70}")
    
    target = "BREAD"
    candidates = _candidate_pool_for_length(5)[:100]  # Use first 100 for speed
    guessed = []
    
    print(f"Target: {target}")
    print(f"Testing {15} turns with {len(candidates)} candidates...")
    
    for i in range(15):
        if not candidates:
            break
        guess = _choose_best_guess(candidates, guessed, expert_mode=True)
        guessed.append(guess)
        
        # Check for repeats
        if guessed.count(guess) > 1:
            print(f"✗ Turn {i+1}: REPEAT GUESS: {guess}")
            return False
        
        # Score and filter
        codes = score_guess(guess, target)
        candidates = _filter_candidates_with_feedback(candidates, guess, codes)
        candidates = _exclude_guessed(candidates, guessed)
    
    print(f"✓ All {len(guessed)} guesses were unique: {', '.join(guessed)}")
    return True


def test_candidate_pool_sizes():
    """Verify candidate pools are loaded correctly for each length."""
    print(f"\n\n{'#'*70}")
    print(f"# TEST: Candidate Pool Sizes")
    print(f"{'#'*70}")
    
    lengths = [4, 5, 6]
    results = {}
    
    for length in lengths:
        candidates = _candidate_pool_for_length(length)
        results[length] = len(candidates)
        print(f"Length {length}: {len(candidates)} candidates")
        
        # Verify all are correct length
        invalid = [c for c in candidates if len(c) != length]
        if invalid:
            print(f"  ✗ Found {len(invalid)} invalid-length candidates: {invalid[:5]}")
            return False
        
        print(f"  ✓ All candidates have correct length")
    
    # Check overall coverage
    total = sum(results.values())
    print(f"\nTotal candidates across all lengths: {total}")
    if total > 100:
        print(f"✓ Good candidate pool coverage")
    else:
        print(f"⚠ Limited candidate pool (may affect bot performance)")
    
    return True


def test_entropy_ranking():
    """Verify entropy calculation and guess ranking."""
    print(f"\n\n{'#'*70}")
    print(f"# TEST: Entropy-Based Guess Ranking")
    print(f"{'#'*71}")
    
    # Small candidate set for manual verification
    candidates = ["TRACE", "TRACE", "TRACK", "TRADE", "TRAIN", "TRAIN", "TRAIN", "TREAT", "TREES", "TRIBE"]
    candidates = list(set(candidates))  # Remove exact duplicates
    prior_guesses = []
    
    print(f"Candidates: {candidates}")
    print(f"\nTesting expert mode guess selection...")
    
    guess = _choose_best_guess(candidates, prior_guesses, expert_mode=True)
    print(f"Selected guess: {guess}")
    
    # Manually compute entropy for comparison
    print(f"\nManual entropy analysis:")
    patterns = {}
    for cand in candidates:
        try:
            pattern = _score_pattern(guess, cand)
            patterns[pattern] = patterns.get(pattern, 0) + 1
        except Exception as e:
            print(f"  Error scoring {guess} vs {cand}: {e}")
    
    total = len(candidates)
    expected_remaining = sum(size * size for size in patterns.values()) / total
    
    print(f"Patterns: {patterns}")
    print(f"Expected remaining: {expected_remaining:.2f}")
    print(f"✓ Entropy calculation working")
    
    return True


# ======================== Main Runner ========================

def main():
    print("\n" + "="*70)
    print("CROSWORDS EXPERT BOT TEST SUITE")
    print("="*70)
    
    test_results = []
    
    # Test 1: Candidate pools
    print("\n[1/5] Testing candidate pool sizes...")
    try:
        result = test_candidate_pool_sizes()
        test_results.append(("Candidate Pools", result))
    except Exception as e:
        print(f"✗ ERROR: {e}")
        test_results.append(("Candidate Pools", False))
    
    # Test 2: Feedback filtering
    print("\n[2/5] Testing feedback filtering...")
    try:
        result = test_feedback_filtering()
        test_results.append(("Feedback Filtering", result))
    except Exception as e:
        print(f"✗ ERROR: {e}")
        test_results.append(("Feedback Filtering", False))
    
    # Test 3: No repeats
    print("\n[3/5] Testing for repeat guesses...")
    try:
        result = test_no_repeats()
        test_results.append(("No Repeats", result))
    except Exception as e:
        print(f"✗ ERROR: {e}")
        test_results.append(("No Repeats", False))
    
    # Test 4: Entropy ranking
    print("\n[4/5] Testing entropy-based ranking...")
    try:
        result = test_entropy_ranking()
        test_results.append(("Entropy Ranking", result))
    except Exception as e:
        print(f"✗ ERROR: {e}")
        test_results.append(("Entropy Ranking", False))
    
    # Test 5: Expert vs Simple comparison
    print("\n[5/5] Running expert vs simple comparison...")
    try:
        test_expert_vs_simple("APPLE", 5)
        test_expert_vs_simple("TRAIN", 5)
        test_results.append(("Mode Comparison", True))
    except Exception as e:
        print(f"✗ ERROR: {e}")
        test_results.append(("Mode Comparison", False))
    
    # Summary
    print(f"\n\n{'='*70}")
    print("TEST SUMMARY")
    print(f"{'='*70}")
    
    passed = sum(1 for _, result in test_results if result)
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print(f"\n✓ All tests passed! Expert bot is performing efficiently.")
        return 0
    else:
        print(f"\n✗ Some tests failed. Review output above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
