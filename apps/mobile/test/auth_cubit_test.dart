import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:music_dna/src/features/auth/domain/entities/auth_user.dart';
import 'package:music_dna/src/features/auth/domain/repositories/auth_repository.dart';
import 'package:music_dna/src/features/auth/presentation/cubit/auth_cubit.dart';

void main() {
  group('AuthCubit', () {
    test('starts authenticated when repository already has a user', () async {
      final repository = FakeAuthRepository(
        initialUser: const AuthUser(id: 'user-1', email: 'alan@example.com'),
      );
      final cubit = AuthCubit(repository);

      addTearDown(repository.dispose);
      addTearDown(cubit.close);

      cubit.initialize();

      expect(cubit.state.status, AuthStatus.authenticated);
      expect(cubit.state.user?.email, 'alan@example.com');
    });

    test('emits failure when sign in throws', () async {
      final repository = FakeAuthRepository(
        signInError: Exception('bad credentials'),
      );
      final cubit = AuthCubit(repository);

      addTearDown(repository.dispose);
      addTearDown(cubit.close);

      cubit.initialize();
      await cubit.signIn(email: 'alan@example.com', password: 'not-right');

      expect(cubit.state.status, AuthStatus.unauthenticated);
      expect(cubit.state.submissionStatus, AuthSubmissionStatus.failure);
      expect(cubit.state.errorMessage, contains('bad credentials'));
    });

    test(
      'keeps sign up unauthenticated when email confirmation is required',
      () async {
        final repository = FakeAuthRepository(signUpHasActiveSession: false);
        final cubit = AuthCubit(repository);

        addTearDown(repository.dispose);
        addTearDown(cubit.close);

        cubit.initialize();
        await cubit.signUp(
          email: 'alan@example.com',
          password: 'good-password',
        );

        expect(cubit.state.status, AuthStatus.unauthenticated);
        expect(
          cubit.state.submissionStatus,
          AuthSubmissionStatus.emailConfirmationRequired,
        );
        expect(cubit.state.infoMessage, contains('Check your email'));
      },
    );
  });
}

class FakeAuthRepository implements AuthRepository {
  FakeAuthRepository({
    AuthUser? initialUser,
    this.signInError,
    this.signUpError,
    this.signUpHasActiveSession = true,
  }) : _currentUser = initialUser;

  final Object? signInError;
  final Object? signUpError;
  final bool signUpHasActiveSession;
  final _controller = StreamController<AuthUser?>.broadcast();
  AuthUser? _currentUser;

  @override
  AuthUser? get currentUser => _currentUser;

  @override
  Stream<AuthUser?> observeAuthState() => _controller.stream;

  @override
  Future<AuthUser> ensureAnonymousSession() async {
    final user = const AuthUser(id: 'anon-user', isAnonymous: true);
    _currentUser = user;
    _controller.add(user);
    return user;
  }

  @override
  Future<AuthUser> signIn({
    required String email,
    required String password,
  }) async {
    if (signInError != null) {
      throw signInError!;
    }
    final user = AuthUser(id: 'signed-in', email: email);
    _currentUser = user;
    _controller.add(user);
    return user;
  }

  @override
  Future<AuthSignUpResult> signUp({
    required String email,
    required String password,
  }) async {
    if (signUpError != null) {
      throw signUpError!;
    }
    final user = AuthUser(id: 'signed-up', email: email);
    if (signUpHasActiveSession) {
      _currentUser = user;
      _controller.add(user);
    }
    return AuthSignUpResult(
      user: user,
      hasActiveSession: signUpHasActiveSession,
    );
  }

  @override
  Future<void> signOut() async {
    _currentUser = null;
    _controller.add(null);
  }

  @override
  Future<void> deleteAccount() async {
    await signOut();
  }

  Future<void> dispose() async {
    await _controller.close();
  }
}
