import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/config/app_config.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../features/auth/presentation/cubit/auth_cubit.dart';

class FoundationHomePage extends StatelessWidget {
  const FoundationHomePage({required this.config, super.key});

  final AppConfig config;
  static final Uri _privacyUri = Uri.parse('https://www.musicdna.fm/privacy');
  static final Uri _termsUri = Uri.parse('https://www.musicdna.fm/terms');

  Future<void> _openExternalLink(Uri uri) async {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: BlocBuilder<AuthCubit, AuthState>(
          builder: (context, state) {
            final hasSession = state.status == AuthStatus.authenticated;
            final hasAccount =
                hasSession && !(state.user?.isAnonymous ?? false);

            return ListView(
              padding: const EdgeInsets.fromLTRB(24, 20, 24, 40),
              children: <Widget>[
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    const Expanded(child: _MusicDnaWordmark()),
                    if (!hasAccount)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: TextButton(
                          onPressed: () => context.go('/auth'),
                          style: TextButton.styleFrom(
                            foregroundColor: AppTheme.foreground,
                            textStyle: theme.textTheme.labelSmall,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                          ),
                          child: const Text('Sign in'),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 20),
                Text(
                  'Why do you love the songs you love?',
                  style: theme.textTheme.displayMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 18),
                Text(
                  hasAccount
                      ? 'The songs you choose tell a story.\nWe\'re just here to read it.'
                      : 'The songs you choose tell a story.\nWe\'re just here to read it.',
                  style: theme.textTheme.bodyLarge?.copyWith(
                    color: AppTheme.mutedForeground,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 20),
                _PrimaryCalloutCard(
                  title: hasAccount
                      ? 'Give me three songs you love...'
                      : 'Give me three songs you love...',
                  body: hasAccount
                      ? 'Songs that never leave your playlist. Songs that still hit you years later.'
                      : 'Songs that never leave your playlist. Songs that still hit you years later.',
                  primaryLabel: hasAccount
                      ? 'Start your Music DNA'
                      : 'Start your Music DNA',
                  primaryAction: () => context.go('/onboarding'),
                  footnote: 'Free · No signup required',
                ),
                const SizedBox(height: 28),
                _SectionCard(
                  eyebrow: 'How it works',
                  title: 'Not genres. Not playlists. Just choices.',
                  body:
                      'You start with three songs that feel undeniably yours. We react to each one, build a working read, then use head-to-head pairings to figure out what keeps pulling you back.',
                  child: const _HowItWorksSteps(),
                ),
                const SizedBox(height: 20),
                Center(
                  child: OutlinedButton(
                    onPressed: () => context.go('/auth'),
                    child: Text(hasAccount ? 'Manage account' : 'Sign in'),
                  ),
                ),
                const SizedBox(height: 20),
                Wrap(
                  alignment: WrapAlignment.center,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 8,
                  children: <Widget>[
                    TextButton(
                      onPressed: () => _openExternalLink(_privacyUri),
                      style: TextButton.styleFrom(
                        foregroundColor: AppTheme.mutedForeground,
                        textStyle: theme.textTheme.labelSmall,
                      ),
                      child: const Text('Privacy Policy'),
                    ),
                    Text(
                      '·',
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: AppTheme.mutedForeground,
                      ),
                    ),
                    TextButton(
                      onPressed: () => _openExternalLink(_termsUri),
                      style: TextButton.styleFrom(
                        foregroundColor: AppTheme.mutedForeground,
                        textStyle: theme.textTheme.labelSmall,
                      ),
                      child: const Text('Terms of Service'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Center(
                  child: Text(
                    '${config.environment.toUpperCase()} · ${config.apiBaseUrl}',
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: AppTheme.mutedForeground,
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _MusicDnaWordmark extends StatelessWidget {
  const _MusicDnaWordmark();

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.center,
      child: Image.asset(
        'assets/branding/music-dna-logo.png',
        width: 170,
        fit: BoxFit.contain,
      ),
    );
  }
}

class _PrimaryCalloutCard extends StatelessWidget {
  const _PrimaryCalloutCard({
    required this.title,
    required this.body,
    required this.primaryLabel,
    required this.primaryAction,
    this.footnote,
  });

  final String title;
  final String body;
  final String primaryLabel;
  final VoidCallback primaryAction;
  final String? footnote;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: <Widget>[
            Text(
              title,
              style: theme.textTheme.headlineMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 14),
            Text(
              body,
              style: theme.textTheme.bodyLarge?.copyWith(
                color: AppTheme.mutedForeground,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            Center(
              child: FilledButton(
                onPressed: primaryAction,
                child: Text(primaryLabel),
              ),
            ),
            if (footnote != null) ...<Widget>[
              const SizedBox(height: 12),
              Text(
                footnote!,
                style: theme.textTheme.labelSmall?.copyWith(
                  color: AppTheme.mutedForeground,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.eyebrow,
    required this.title,
    required this.body,
    this.child,
  });

  final String eyebrow;
  final String title;
  final String body;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: <Widget>[
            Text(eyebrow, style: theme.textTheme.labelSmall, textAlign: TextAlign.center),
            const SizedBox(height: 14),
            Text(
              title,
              style: theme.textTheme.headlineSmall,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            Text(
              body,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: AppTheme.mutedForeground,
              ),
              textAlign: TextAlign.center,
            ),
            if (child != null) ...<Widget>[const SizedBox(height: 20), child!],
          ],
        ),
      ),
    );
  }
}

class _HowItWorksSteps extends StatelessWidget {
  const _HowItWorksSteps();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    const steps = <({String number, String title, String body})>[
      (
        number: '01',
        title: 'Name three songs you love',
        body:
            'The songs that never leave your playlist. The songs you stop skipping. The songs that still hit years later.',
      ),
      (
        number: '02',
        title: 'Make some impossible choices',
        body:
            'We\'ll put great songs head-to-head and ask you to choose. Some decisions take a second. Some will make you stare at the screen and argue with yourself. That\'s the point.',
      ),
      (
        number: '03',
        title: 'See what your choices reveal',
        body:
            'Discover the hidden patterns in your taste. Hidden inside your choices are patterns you probably never noticed: what moves you, what you value, and why certain songs stay with you long after others fade away. Think of it as a personality test written by your record collection.',
      ),
    ];

    return Column(
      children: steps
          .map(
            (step) => Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: AppTheme.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppTheme.border),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(step.number, style: theme.textTheme.labelSmall),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: <Widget>[
                        Text(
                          step.title,
                          style: theme.textTheme.titleMedium,
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 6),
                        Text(
                          step.body,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: AppTheme.mutedForeground,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          )
          .toList(growable: false),
    );
  }
}
