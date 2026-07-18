import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_theme.dart';
import '../cubit/auth_cubit.dart';

enum _AuthFormMode { signIn, signUp }

class AuthStubPage extends StatefulWidget {
  const AuthStubPage({super.key});

  @override
  State<AuthStubPage> createState() => _AuthStubPageState();
}

class _AuthStubPageState extends State<AuthStubPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  _AuthFormMode _mode = _AuthFormMode.signIn;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: BlocConsumer<AuthCubit, AuthState>(
          listenWhen: (previous, current) =>
              previous.submissionStatus != current.submissionStatus,
          listener: (context, state) {
            if (state.submissionStatus == AuthSubmissionStatus.failure &&
                state.errorMessage != null) {
              ScaffoldMessenger.of(
                context,
              ).showSnackBar(SnackBar(content: Text(state.errorMessage!)));
            }

            if (state.submissionStatus == AuthSubmissionStatus.success &&
                state.status == AuthStatus.authenticated) {
              context.go(_mode == _AuthFormMode.signUp ? '/onboarding' : '/');
            }
          },
          builder: (context, state) {
            final isSubmitting =
                state.submissionStatus == AuthSubmissionStatus.submitting;

            return ListView(
              padding: const EdgeInsets.fromLTRB(24, 20, 24, 40),
              children: <Widget>[
                TextButton(
                  onPressed: () => context.go('/'),
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    alignment: Alignment.centerLeft,
                  ),
                  child: const Text('← Back'),
                ),
                const SizedBox(height: 12),
                Image.asset(
                  'assets/branding/music-dna-logo.png',
                  width: 170,
                  alignment: Alignment.centerLeft,
                ),
                const SizedBox(height: 28),
                Text(
                  _mode == _AuthFormMode.signIn
                      ? 'Continue your MusicDNA.'
                      : 'Begin your MusicDNA.',
                  style: theme.textTheme.displayMedium,
                ),
                const SizedBox(height: 18),
                Text(
                  _mode == _AuthFormMode.signIn
                      ? 'Your readings persist across sessions. Sign in and pick up where your taste left off.'
                      : 'Email and a password. No social, no ceremony. We will move straight into the opening interview.',
                  style: theme.textTheme.bodyLarge?.copyWith(
                    color: AppTheme.mutedForeground,
                  ),
                ),
                const SizedBox(height: 28),
                _ModeToggle(
                  mode: _mode,
                  onChanged: (mode) {
                    context.read<AuthCubit>().clearFeedback();
                    setState(() => _mode = mode);
                  },
                ),
                const SizedBox(height: 20),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text('Account', style: theme.textTheme.labelSmall),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            autofillHints: const <String>[AutofillHints.email],
                            decoration: const InputDecoration(
                              labelText: 'Email',
                            ),
                            validator: (value) {
                              final email = value?.trim() ?? '';
                              if (email.isEmpty) {
                                return 'Email is required.';
                              }
                              if (!email.contains('@')) {
                                return 'Enter a valid email address.';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 16),
                          TextFormField(
                            controller: _passwordController,
                            obscureText: true,
                            autofillHints: _mode == _AuthFormMode.signIn
                                ? const <String>[AutofillHints.password]
                                : const <String>[AutofillHints.newPassword],
                            decoration: const InputDecoration(
                              labelText: 'Password',
                            ),
                            validator: (value) {
                              final password = value ?? '';
                              if (password.isEmpty) {
                                return 'Password is required.';
                              }
                              if (_mode == _AuthFormMode.signUp &&
                                  password.length < 8) {
                                return 'Use at least 8 characters.';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 20),
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton(
                              onPressed: isSubmitting ? null : _submit,
                              child: Text(
                                isSubmitting
                                    ? 'Working...'
                                    : _mode == _AuthFormMode.signIn
                                    ? 'Sign in'
                                    : 'Create account',
                              ),
                            ),
                          ),
                          if (state.errorMessage != null) ...<Widget>[
                            const SizedBox(height: 14),
                            Text(
                              state.errorMessage!,
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.error,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
                if (state.user != null) ...<Widget>[
                  const SizedBox(height: 20),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            'Current session',
                            style: theme.textTheme.labelSmall,
                          ),
                          const SizedBox(height: 12),
                          Text(
                            state.user?.email ?? state.user!.id,
                            style: theme.textTheme.titleMedium,
                          ),
                          const SizedBox(height: 18),
                          Wrap(
                            spacing: 12,
                            runSpacing: 12,
                            children: <Widget>[
                              FilledButton.tonal(
                                onPressed: () => context.go('/onboarding'),
                                child: const Text('Go to onboarding'),
                              ),
                              OutlinedButton(
                                onPressed: () =>
                                    context.read<AuthCubit>().signOut(),
                                child: const Text('Sign out'),
                              ),
                            ],
                          ),
                        ],
                      ),
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
    if (!_formKey.currentState!.validate()) {
      return;
    }

    final authCubit = context.read<AuthCubit>();
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (_mode == _AuthFormMode.signIn) {
      authCubit.signIn(email: email, password: password);
      return;
    }

    authCubit.signUp(email: email, password: password);
  }
}

class _ModeToggle extends StatelessWidget {
  const _ModeToggle({required this.mode, required this.onChanged});

  final _AuthFormMode mode;
  final ValueChanged<_AuthFormMode> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: AppTheme.surfaceRaised,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppTheme.border),
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: _ModeButton(
              label: 'Sign in',
              selected: mode == _AuthFormMode.signIn,
              onTap: () => onChanged(_AuthFormMode.signIn),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _ModeButton(
              label: 'Sign up',
              selected: mode == _AuthFormMode.signUp,
              onTap: () => onChanged(_AuthFormMode.signUp),
            ),
          ),
        ],
      ),
    );
  }
}

class _ModeButton extends StatelessWidget {
  const _ModeButton({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: selected ? AppTheme.ember : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: theme.textTheme.titleSmall?.copyWith(
            color: AppTheme.foreground,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}
