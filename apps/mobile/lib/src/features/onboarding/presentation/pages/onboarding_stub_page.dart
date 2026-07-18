import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../auth/presentation/cubit/auth_cubit.dart';
import '../cubit/onboarding_cubit.dart';

class OnboardingStubPage extends StatefulWidget {
  const OnboardingStubPage({super.key});

  @override
  State<OnboardingStubPage> createState() => _OnboardingStubPageState();
}

class _OnboardingStubPageState extends State<OnboardingStubPage> {
  final _formKey = GlobalKey<FormState>();
  final _songController = TextEditingController();
  bool _isTransitioningToSession = false;

  static const List<String> _slotLabels = <String>[
    'the one at the top',
    'now #2',
    'and the third',
  ];

  static const List<String> _defaultPrompts = <String>[
    'start with a song you love',
    'now give me one more',
    'one more and i can commit',
  ];

  static const List<String> _defaultHints = <String>[
    'Ceremony — New Order',
    'Pyramid Song — Radiohead',
    'Untrue — Burial',
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authCubit = context.read<AuthCubit>();
      if (authCubit.state.user == null) {
        authCubit.ensureAnonymousSession();
      }
    });
  }

  @override
  void dispose() {
    _songController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: BlocConsumer<OnboardingCubit, OnboardingState>(
          listenWhen: (previous, current) =>
              previous.stage != current.stage ||
              previous.startedSession != current.startedSession,
          listener: (context, state) async {
            if (state.stage == OnboardingStage.failure &&
                state.errorMessage != null) {
              ScaffoldMessenger.of(
                context,
              ).showSnackBar(SnackBar(content: Text(state.errorMessage!)));
            }

            if (state.stage == OnboardingStage.success &&
                state.startedSession != null &&
                !_isTransitioningToSession) {
              final router = GoRouter.of(context);
              final startedSession = state.startedSession!;
              setState(() => _isTransitioningToSession = true);
              await Future<void>.delayed(const Duration(milliseconds: 1400));
              if (!mounted) {
                return;
              }
              router.go('/session', extra: startedSession);
            }
          },
          builder: (context, state) {
            final authState = context.watch<AuthCubit>().state;
            final currentIndex = state.currentSongIndex.clamp(0, 2);
            final bootingAnonymousSession =
                authState.user == null &&
                authState.submissionStatus == AuthSubmissionStatus.submitting;
            final prompt = state.nextLabel?.trim().isNotEmpty == true
                ? state.nextLabel!.toLowerCase()
                : _defaultPrompts[currentIndex];
            final hint = _defaultHints[currentIndex];
            final lockedSongCount = state.songs.length;
            final showInput =
                !_isTransitioningToSession &&
                state.stage != OnboardingStage.success;

            return ListView(
              padding: const EdgeInsets.fromLTRB(28, 28, 28, 52),
              children: <Widget>[
                Text('THE INTERVIEW', style: theme.textTheme.labelSmall),
                if (bootingAnonymousSession) ...<Widget>[
                  const SizedBox(height: 18),
                  Text(
                    'starting a session for you...',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppTheme.mutedForeground,
                    ),
                  ),
                ],
                const SizedBox(height: 44),
                for (
                  var index = 0;
                  index < lockedSongCount;
                  index++
                ) ...<Widget>[
                  _SongEntryRow(index: index, song: state.songs[index]),
                  if (index < state.reactions.length) ...<Widget>[
                    const SizedBox(height: 18),
                    _CriticLine(text: state.reactions[index].reaction),
                  ],
                  const SizedBox(height: 38),
                ],
                if (showInput) ...<Widget>[
                  Text(
                    prompt,
                    style: theme.textTheme.headlineLarge?.copyWith(
                      color: AppTheme.mutedForeground,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                  const SizedBox(height: 34),
                  Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        _SlotMetaRow(
                          index: currentIndex,
                          label: _slotLabels[currentIndex].toUpperCase(),
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _songController,
                          textInputAction: TextInputAction.done,
                          enabled:
                              !state.isSubmitting && !bootingAnonymousSession,
                          style: theme.textTheme.headlineMedium?.copyWith(
                            color: AppTheme.foreground,
                          ),
                          decoration: InputDecoration(
                            hintText: hint,
                            filled: false,
                            contentPadding: EdgeInsets.zero,
                            hintStyle: theme.textTheme.headlineMedium?.copyWith(
                              color: AppTheme.mutedForeground.withValues(
                                alpha: 0.35,
                              ),
                            ),
                            enabledBorder: const UnderlineInputBorder(
                              borderSide: BorderSide(color: AppTheme.ember),
                            ),
                            focusedBorder: const UnderlineInputBorder(
                              borderSide: BorderSide(
                                color: AppTheme.ember,
                                width: 2,
                              ),
                            ),
                          ),
                          validator: (value) {
                            final text = value?.trim() ?? '';
                            if (text.isEmpty) {
                              return 'Name a song first.';
                            }
                            return null;
                          },
                          onFieldSubmitted: (_) => _submit(),
                        ),
                        const SizedBox(height: 28),
                        _ContinueButton(
                          busy: state.isSubmitting || bootingAnonymousSession,
                          onPressed: _submit,
                        ),
                        if (state.requiresReauthentication) ...<Widget>[
                          const SizedBox(height: 14),
                          OutlinedButton(
                            onPressed: () => context.go('/auth'),
                            child: const Text('Sign in again'),
                          ),
                        ],
                        if (authState.submissionStatus ==
                                AuthSubmissionStatus.failure &&
                            authState.errorMessage != null) ...<Widget>[
                          const SizedBox(height: 12),
                          Text(
                            authState.errorMessage!,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.error,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
                if (state.startedSession != null) ...<Widget>[
                  const SizedBox(height: 24),
                  Text(
                    'NEXT ONE COMING UP…',
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: AppTheme.mutedForeground,
                    ),
                  ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }

  void _submit() {
    final onboardingState = context.read<OnboardingCubit>().state;
    final authState = context.read<AuthCubit>().state;
    if (onboardingState.isSubmitting ||
        authState.submissionStatus == AuthSubmissionStatus.submitting) {
      return;
    }
    if (!_formKey.currentState!.validate()) {
      return;
    }

    final song = _songController.text.trim();
    if (song.isEmpty) {
      return;
    }

    context.read<OnboardingCubit>().submitSong(song: song);
    _songController.clear();
  }
}

class _SongEntryRow extends StatelessWidget {
  const _SongEntryRow({required this.index, required this.song});

  final int index;
  final String song;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: <Widget>[
        Text(
          '#${index + 1}',
          style: theme.textTheme.bodyMedium?.copyWith(
            fontFamily: 'monospace',
            color: AppTheme.mutedForeground,
            letterSpacing: 1.4,
          ),
        ),
        const SizedBox(width: 18),
        const Icon(Icons.check, size: 18, color: AppTheme.foreground),
        const SizedBox(width: 18),
        Expanded(
          child: Text(
            song.toLowerCase(),
            style: theme.textTheme.headlineMedium?.copyWith(
              fontFamily: 'monospace',
              letterSpacing: 0.3,
            ),
          ),
        ),
      ],
    );
  }
}

class _SlotMetaRow extends StatelessWidget {
  const _SlotMetaRow({required this.index, required this.label});

  final int index;
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: <Widget>[
        Text(
          '#${index + 1}',
          style: theme.textTheme.bodyMedium?.copyWith(
            fontFamily: 'monospace',
            color: AppTheme.mutedForeground,
            letterSpacing: 1.4,
          ),
        ),
        const SizedBox(width: 20),
        Text(label, style: theme.textTheme.labelSmall),
      ],
    );
  }
}

class _CriticLine extends StatelessWidget {
  const _CriticLine({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 68),
      child: Text(text, style: Theme.of(context).textTheme.headlineLarge),
    );
  }
}

class _ContinueButton extends StatelessWidget {
  const _ContinueButton({required this.busy, required this.onPressed});

  final bool busy;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 86,
      height: 86,
      child: FilledButton(
        onPressed: busy ? null : onPressed,
        style: FilledButton.styleFrom(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          padding: EdgeInsets.zero,
          backgroundColor: const Color(0xFF7B241E),
        ),
        child: busy
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Icon(Icons.arrow_forward, size: 28),
      ),
    );
  }
}
