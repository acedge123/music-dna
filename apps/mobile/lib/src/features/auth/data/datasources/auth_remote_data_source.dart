import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../../core/network/app_api_exception.dart';
import '../../../../core/network/music_dna_api_client.dart';
import '../../domain/entities/auth_user.dart' as domain;

abstract class AuthRemoteDataSource {
  domain.AuthUser? get currentUser;

  Stream<domain.AuthUser?> observeAuthState();

  Future<domain.AuthUser> ensureAnonymousSession();

  Future<domain.AuthUser> signIn({
    required String email,
    required String password,
  });

  Future<domain.AuthSignUpResult> signUp({
    required String email,
    required String password,
  });

  Future<void> signOut();

  Future<void> deleteAccount();
}

class SupabaseAuthRemoteDataSource implements AuthRemoteDataSource {
  SupabaseAuthRemoteDataSource(this._supabase, this._apiClient);

  final SupabaseClient _supabase;
  final MusicDnaApiClient _apiClient;

  @override
  domain.AuthUser? get currentUser =>
      _mapUser(_supabase.auth.currentSession?.user);

  @override
  Stream<domain.AuthUser?> observeAuthState() {
    return _supabase.auth.onAuthStateChange.map(
      (AuthState authState) => _mapUser(authState.session?.user),
    );
  }

  @override
  Future<domain.AuthUser> ensureAnonymousSession() async {
    final existingSession = _supabase.auth.currentSession;
    if (existingSession?.user != null) {
      return _requireUser(existingSession!.user);
    }

    final response = await _supabase.auth.signInAnonymously();
    final user = response.user;
    if (user == null) {
      throw const AuthRemoteDataSourceException(
        'Supabase did not return a user for anonymous sign in.',
      );
    }

    return _requireUser(user);
  }

  @override
  Future<domain.AuthUser> signIn({
    required String email,
    required String password,
  }) async {
    final response = await _supabase.auth.signInWithPassword(
      email: email,
      password: password,
    );
    final user = response.user;
    if (user == null) {
      throw const AuthRemoteDataSourceException(
        'Supabase did not return a user for sign in.',
      );
    }

    return _requireUser(user);
  }

  @override
  Future<domain.AuthSignUpResult> signUp({
    required String email,
    required String password,
  }) async {
    final response = await _supabase.auth.signUp(
      email: email,
      password: password,
    );
    final user = response.user;
    if (user == null) {
      throw const AuthRemoteDataSourceException(
        'Supabase did not return a user for sign up.',
      );
    }

    return domain.AuthSignUpResult(
      user: _requireUser(user),
      hasActiveSession: response.session != null,
    );
  }

  @override
  Future<void> signOut() {
    return _supabase.auth.signOut();
  }

  @override
  Future<void> deleteAccount() async {
    final response = await _apiClient.delete('/api/v1/account');
    if (response.statusCode >= 400) {
      throw AppApiException(
        kind: response.statusCode == 401
            ? AppApiErrorKind.unauthorized
            : AppApiErrorKind.unknown,
        statusCode: response.statusCode,
        message: 'We could not delete your account right now.',
      );
    }

    await _supabase.auth.signOut();
  }

  domain.AuthUser? _mapUser(User? user) {
    if (user == null) {
      return null;
    }

    return domain.AuthUser(
      id: user.id,
      email: user.email,
      isAnonymous: user.isAnonymous,
    );
  }

  domain.AuthUser _requireUser(User user) {
    return domain.AuthUser(
      id: user.id,
      email: user.email,
      isAnonymous: user.isAnonymous,
    );
  }
}

class AuthRemoteDataSourceException implements Exception {
  const AuthRemoteDataSourceException(this.message);

  final String message;

  @override
  String toString() => 'AuthRemoteDataSourceException: $message';
}
