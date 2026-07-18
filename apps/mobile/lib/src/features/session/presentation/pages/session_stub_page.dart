import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../onboarding/domain/entities/started_music_session.dart';
import '../../domain/entities/session_pairing.dart';
import '../../domain/entities/session_reveal.dart';
import '../cubit/session_cubit.dart';

class SessionStubPage extends StatefulWidget {
  const SessionStubPage({
    super.key,
    required this.shareBaseUrl,
    this.startedSession,
  });

  final String shareBaseUrl;
  final StartedMusicSession? startedSession;

  @override
  State<SessionStubPage> createState() => _SessionStubPageState();
}

class _SessionStubPageState extends State<SessionStubPage> {
  Stopwatch? _stopwatch;
  String? _pairingId;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncStopwatch(
      context.read<SessionCubit>().state.currentRound?.pairing?.id,
    );
  }

  @override
  void dispose() {
    _stopwatch?.stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: BlocConsumer<SessionCubit, SessionState>(
          listenWhen: (previous, current) =>
              previous.currentRound?.pairing?.id !=
              current.currentRound?.pairing?.id,
          listener: (context, state) {
            _syncStopwatch(state.currentRound?.pairing?.id);
          },
          builder: (context, state) {
            final round = state.currentRound;
            final pairing = round?.pairing;
            final startedSession =
                state.startedSession ?? widget.startedSession;
            final isBusy =
                state.status == SessionStatus.loading ||
                state.status == SessionStatus.submitting;

            return ListView(
              padding: const EdgeInsets.fromLTRB(28, 28, 28, 52),
              children: <Widget>[
                Text('THE INTERVIEW', style: theme.textTheme.labelSmall),
                if (startedSession != null) ...<Widget>[
                  const SizedBox(height: 34),
                  _OpeningTranscript(session: startedSession),
                  const SizedBox(height: 34),
                  _CriticBridge(hypothesis: startedSession.hypothesis),
                  const SizedBox(height: 26),
                ],
                if (state.lastFeedback != null)
                  _FeedbackCard(feedback: state.lastFeedback!),
                if (state.lastFeedback != null) const SizedBox(height: 16),
                if (state.errorMessage != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Text(
                      state.errorMessage!,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.error,
                      ),
                    ),
                  ),
                switch (state.status) {
                  SessionStatus.initial ||
                  SessionStatus.loading => const Center(
                    child: Padding(
                      padding: EdgeInsets.symmetric(vertical: 48),
                      child: CircularProgressIndicator(),
                    ),
                  ),
                  SessionStatus.submitting => Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      if (pairing != null) _PairingIntro(pairing: pairing),
                      if (pairing != null) const SizedBox(height: 18),
                      if (pairing != null)
                        _PairingCard(
                          pairing: pairing,
                          isBusy: true,
                          onChoose: (_) {},
                        ),
                      const SizedBox(height: 20),
                      const Center(child: CircularProgressIndicator()),
                    ],
                  ),
                  SessionStatus.ready =>
                    pairing == null
                        ? _FallbackCard(
                            title: 'No pairing yet',
                            body:
                                'We are in the interview, but the next comparison did not come through yet.',
                            primaryLabel: 'Try again',
                            onPrimary: () =>
                                context.read<SessionCubit>().initialize(),
                          )
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              _PairingIntro(pairing: pairing),
                              const SizedBox(height: 18),
                              _PairingCard(
                                pairing: pairing,
                                isBusy: isBusy,
                                onChoose: (songId) =>
                                    _chooseSong(context, chosenSongId: songId),
                              ),
                            ],
                          ),
                  SessionStatus.completed => _FallbackCard(
                    title: 'Good. We have enough.',
                    body:
                        'Now let me turn those choices into a sharper read of your taste.',
                    primaryLabel: 'Generate my reading',
                    onPrimary: () =>
                        context.read<SessionCubit>().revealSession(),
                  ),
                  SessionStatus.revealing => _FallbackCard(
                    title: 'Building your reading',
                    body:
                        'Tightening the theory, checking the pattern, and turning it into a read worth keeping.',
                    primaryLabel: 'Generating...',
                    onPrimary: () {},
                    primaryEnabled: false,
                    busy: true,
                  ),
                  SessionStatus.revealed =>
                    state.reveal == null
                        ? _FallbackCard(
                            title: 'Reading unavailable',
                            body:
                                'The session finished, but the reveal payload did not come back yet.',
                            primaryLabel: 'Try reveal again',
                            onPrimary: () =>
                                context.read<SessionCubit>().revealSession(),
                          )
                        : _RevealCard(
                            reveal: state.reveal!,
                            sharedReveal: state.sharedReveal,
                            shareUrl: _buildShareUrl(state.reveal!),
                            onCopyShare: () =>
                                _copyShare(context, state.reveal!),
                          ),
                  SessionStatus.failure => _FallbackCard(
                    title: 'The read got interrupted',
                    body:
                        state.errorMessage ??
                        'We could not continue the pairing loop right now.',
                    primaryLabel: state.currentRound?.done == true
                        ? 'Try reveal again'
                        : 'Retry session',
                    onPrimary: () => state.currentRound?.done == true
                        ? context.read<SessionCubit>().revealSession()
                        : context.read<SessionCubit>().initialize(),
                    secondaryLabel: state.requiresReauthentication
                        ? 'Sign in again'
                        : null,
                    onSecondary: state.requiresReauthentication
                        ? () => context.go('/auth')
                        : null,
                  ),
                  SessionStatus.missingSession => _FallbackCard(
                    title: 'Start with the interview first',
                    body:
                        'Give me your opening songs first, then we can start drilling into the pairings.',
                    primaryLabel: 'Go to the interview',
                    onPrimary: () => context.go('/onboarding'),
                  ),
                },
              ],
            );
          },
        ),
      ),
    );
  }

  void _chooseSong(BuildContext context, {required String chosenSongId}) {
    final elapsedMs = _stopwatch?.elapsedMilliseconds ?? 0;
    context.read<SessionCubit>().chooseSong(
      chosenSongId: chosenSongId,
      msToDecide: elapsedMs,
    );
  }

  void _syncStopwatch(String? pairingId) {
    if (pairingId == null || pairingId == _pairingId) {
      return;
    }

    _stopwatch?.stop();
    _stopwatch = Stopwatch()..start();
    _pairingId = pairingId;
  }

  String? _buildShareUrl(SessionReveal reveal) {
    final token = reveal.shareToken;
    if (token == null || token.isEmpty) {
      return null;
    }
    return Uri.parse(widget.shareBaseUrl).resolve('/s/$token').toString();
  }

  Future<void> _copyShare(BuildContext context, SessionReveal reveal) async {
    final messenger = ScaffoldMessenger.of(context);
    final shareUrl = _buildShareUrl(reveal);
    if (shareUrl == null || shareUrl.isEmpty) {
      messenger.showSnackBar(
        const SnackBar(content: Text('No share link is available yet.')),
      );
      return;
    }

    await Clipboard.setData(ClipboardData(text: shareUrl));
    if (!mounted) {
      return;
    }
    messenger.showSnackBar(const SnackBar(content: Text('Share link copied.')));
  }
}

class _OpeningTranscript extends StatelessWidget {
  const _OpeningTranscript({required this.session});

  final StartedMusicSession session;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      children: <Widget>[
        for (var index = 0; index < session.songs.length; index++) ...<Widget>[
          _TranscriptSongRow(index: index, song: session.songs[index]),
          const SizedBox(height: 30),
        ],
        Text(
          'NEXT ONE COMING UP…',
          style: theme.textTheme.labelSmall?.copyWith(
            color: AppTheme.mutedForeground,
          ),
        ),
      ],
    );
  }
}

class _CriticBridge extends StatelessWidget {
  const _CriticBridge({required this.hypothesis});

  final String hypothesis;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(hypothesis, style: theme.textTheme.displaySmall),
        const SizedBox(height: 16),
        Text(
          'Let\'s drill down.',
          style: theme.textTheme.bodyLarge?.copyWith(
            color: AppTheme.mutedForeground,
          ),
        ),
      ],
    );
  }
}

class _PairingIntro extends StatelessWidget {
  const _PairingIntro({required this.pairing});

  final SessionPairing pairing;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          'Pick one. Don\'t overthink it.',
          style: theme.textTheme.displaySmall,
        ),
        const SizedBox(height: 12),
        Text(
          pairing.whyGood ??
              'Trust the one that feels more instinctively yours.',
          style: theme.textTheme.bodyLarge?.copyWith(
            color: AppTheme.mutedForeground,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'You can choose only one.',
          style: theme.textTheme.labelSmall?.copyWith(
            color: AppTheme.mutedForeground,
          ),
        ),
      ],
    );
  }
}

class _TranscriptSongRow extends StatelessWidget {
  const _TranscriptSongRow({required this.index, required this.song});

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

class _FeedbackCard extends StatelessWidget {
  const _FeedbackCard({required this.feedback});

  final SessionChoiceFeedback feedback;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppTheme.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              feedback.verdict,
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              feedback.why,
              style: theme.textTheme.bodyLarge?.copyWith(
                color: AppTheme.mutedForeground,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PairingCard extends StatelessWidget {
  const _PairingCard({
    required this.pairing,
    required this.isBusy,
    required this.onChoose,
  });

  final SessionPairing pairing;
  final bool isBusy;
  final ValueChanged<String> onChoose;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Expanded(
          child: _SongChoiceCard(
            song: pairing.songA,
            isBusy: isBusy,
            onChoose: () => onChoose(pairing.songA.id),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _SongChoiceCard(
            song: pairing.songB,
            isBusy: isBusy,
            onChoose: () => onChoose(pairing.songB.id),
          ),
        ),
      ],
    );
  }
}

class _SongChoiceCard extends StatelessWidget {
  const _SongChoiceCard({
    required this.song,
    required this.isBusy,
    required this.onChoose,
  });

  final SessionPairingSong song;
  final bool isBusy;
  final VoidCallback onChoose;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: isBusy ? null : onChoose,
        borderRadius: BorderRadius.circular(20),
        child: Ink(
          decoration: BoxDecoration(
            color: AppTheme.surface,
            border: Border.all(
              color: isBusy
                  ? theme.colorScheme.outlineVariant
                  : AppTheme.border,
            ),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 220),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  if (song.primaryLane != null || song.year != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 18),
                      child: Text(
                        [
                          if (song.primaryLane != null)
                            song.primaryLane!.toUpperCase().replaceAll(
                              '-',
                              '_',
                            ),
                          if (song.year != null) song.year.toString(),
                        ].join('  ·  '),
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: AppTheme.mutedForeground,
                        ),
                      ),
                    ),
                  Text(
                    song.title,
                    style: theme.textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    song.artist,
                    style: theme.textTheme.titleMedium?.copyWith(
                      color: AppTheme.mutedForeground,
                    ),
                  ),
                  const Spacer(),
                  if (isBusy)
                    const Align(
                      alignment: Alignment.bottomLeft,
                      child: SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _FallbackCard extends StatelessWidget {
  const _FallbackCard({
    required this.title,
    required this.body,
    required this.primaryLabel,
    required this.onPrimary,
    this.secondaryLabel,
    this.onSecondary,
    this.primaryEnabled = true,
    this.busy = false,
  });

  final String title;
  final String body;
  final String primaryLabel;
  final VoidCallback onPrimary;
  final String? secondaryLabel;
  final VoidCallback? onSecondary;
  final bool primaryEnabled;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              title,
              style: theme.textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Text(body),
            const SizedBox(height: 20),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: <Widget>[
                FilledButton(
                  onPressed: primaryEnabled ? onPrimary : null,
                  child: busy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(primaryLabel),
                ),
                if (secondaryLabel != null && onSecondary != null)
                  OutlinedButton(
                    onPressed: onSecondary,
                    child: Text(secondaryLabel!),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _RevealCard extends StatelessWidget {
  const _RevealCard({
    required this.reveal,
    required this.sharedReveal,
    required this.shareUrl,
    required this.onCopyShare,
  });

  final SessionReveal reveal;
  final SharedReveal? sharedReveal;
  final String? shareUrl;
  final VoidCallback onCopyShare;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final archetype = sharedReveal?.archetype;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              archetype?.name ??
                  reveal.archetypeName ??
                  'Your MusicDNA reading',
              style: theme.textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
            if (archetype?.tagline != null && archetype!.tagline!.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  archetype.tagline!,
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: theme.colorScheme.primary,
                  ),
                ),
              ),
            const SizedBox(height: 16),
            Text(
              sharedReveal?.interpretation.isNotEmpty == true
                  ? sharedReveal!.interpretation
                  : reveal.interpretation,
              style: theme.textTheme.bodyLarge,
            ),
            if (reveal.allowedClaims.isNotEmpty) ...<Widget>[
              const SizedBox(height: 20),
              Text(
                'What the evidence says',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 12),
              for (final claim in reveal.allowedClaims)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _ClaimCard(claim: claim),
                ),
            ],
            if (reveal.counterarguments.isNotEmpty) ...<Widget>[
              const SizedBox(height: 8),
              Text(
                'Counterarguments',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 12),
              for (final counter in reveal.counterarguments)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(counter.claim),
                  subtitle: Text(counter.notes),
                  trailing: Chip(label: Text(counter.impact)),
                ),
            ],
            if (sharedReveal != null &&
                sharedReveal!.definingChoices.isNotEmpty) ...<Widget>[
              const SizedBox(height: 12),
              Text(
                'Defining choices',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 12),
              for (final choice in sharedReveal!.definingChoices)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(
                    '${choice.chosen} by ${choice.chosenArtist} over '
                    '${choice.rejected} by ${choice.rejectedArtist}',
                  ),
                ),
            ],
            if (shareUrl != null) ...<Widget>[
              const SizedBox(height: 20),
              Text(
                'Share link',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              SelectableText(shareUrl!),
              const SizedBox(height: 12),
              FilledButton.tonal(
                onPressed: onCopyShare,
                child: const Text('Copy share link'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ClaimCard extends StatelessWidget {
  const _ClaimCard({required this.claim});

  final RevealClaim claim;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              claim.tradeoff,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              '${claim.preferred} over ${claim.opposed} · '
              '${claim.supportingChoices}/${claim.testedTotal} supporting choices',
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: <Widget>[
                Chip(
                  label: Text(
                    '${(claim.confidence * 100).round()}% confidence',
                  ),
                ),
                Chip(label: Text(claim.dimension)),
              ],
            ),
            if (claim.examples.isNotEmpty) ...<Widget>[
              const SizedBox(height: 8),
              for (final example in claim.examples.take(2))
                Text(
                  '${example.chosen} over ${example.rejected} '
                  '(${example.delta.toStringAsFixed(2)})',
                ),
            ],
          ],
        ),
      ),
    );
  }
}
