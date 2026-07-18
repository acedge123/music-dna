import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../../domain/entities/auth_user.dart' as domain;

abstract class AuthRemoteDataSource {
  domain.AuthUser? get currentUser;

  Stream<domain.AuthUser?> observeAuthState();

  Future<domain.AuthUser> ensureAnonymousSession();

  Future<domain.AuthUser> signIn({
    required String email,
    required String password,
  });

  Future<domain.AuthUser> signUp({
    required String email,
    required String password,
  });

  Future<void> signOut();
}

class SupabaseAuthRemoteDataSource implements AuthRemoteDataSource {
  SupabaseAuthRemoteDataSource(this._supabase);

  final SupabaseClient _supabase;

  @override
  domain.AuthUser? get currentUser => _mapUser(_supabase.auth.currentUser);

  @override
  Stream<domain.AuthUser?> observeAuthState() {
    return _supabase.auth.onAuthStateChange.map(
      (AuthState authState) => _mapUser(authState.session?.user),
    );
  }

  @override
  Future<domain.AuthUser> ensureAnonymousSession() async {
    final existingUser = _supabase.auth.currentUser;
    if (existingUser != null) {
      return _requireUser(existingUser);
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
  Future<domain.AuthUser> signUp({
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

    return _requireUser(user);
  }

  @override
  Future<void> signOut() {
    return _supabase.auth.signOut();
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
