import 'package:equatable/equatable.dart';

class OnboardingReaction extends Equatable {
  const OnboardingReaction({required this.reaction, this.nextLabel});

  final String reaction;
  final String? nextLabel;

  @override
  List<Object?> get props => <Object?>[reaction, nextLabel];
}
