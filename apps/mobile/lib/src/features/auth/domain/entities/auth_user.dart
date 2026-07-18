import 'package:equatable/equatable.dart';

class AuthUser extends Equatable {
  const AuthUser({required this.id, this.email, this.isAnonymous = false});

  final String id;
  final String? email;
  final bool isAnonymous;

  @override
  List<Object?> get props => <Object?>[id, email, isAnonymous];
}
