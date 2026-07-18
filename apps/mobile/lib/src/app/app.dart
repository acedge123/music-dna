import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../core/di/app_dependencies.dart';
import '../core/theme/app_theme.dart';
import '../features/auth/presentation/cubit/auth_cubit.dart';
import 'router/app_router.dart';

class MusicDnaMobileApp extends StatefulWidget {
  const MusicDnaMobileApp({required this.dependencies, super.key});

  final AppDependencies dependencies;

  @override
  State<MusicDnaMobileApp> createState() => _MusicDnaMobileAppState();
}

class _MusicDnaMobileAppState extends State<MusicDnaMobileApp> {
  late final AuthCubit _authCubit;
  late final router = buildAppRouter(widget.dependencies);

  @override
  void initState() {
    super.initState();
    _authCubit = widget.dependencies.createAuthCubit();
  }

  @override
  void dispose() {
    _authCubit.close();
    widget.dependencies.authRouterNotifier.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider<AuthCubit>.value(
      value: _authCubit,
      child: MaterialApp.router(
        debugShowCheckedModeBanner: false,
        title: widget.dependencies.config.appName,
        theme: AppTheme.dark(),
        routerConfig: router,
      ),
    );
  }
}
