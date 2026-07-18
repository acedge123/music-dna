class AppConfigException implements Exception {
  const AppConfigException(this.message);

  final String message;

  @override
  String toString() => 'AppConfigException: $message';
}

class AppConfig {
  const AppConfig({
    required this.appName,
    required this.environment,
    required this.apiBaseUrl,
    required this.shareBaseUrl,
    required this.supabaseUrl,
    required this.supabaseAnonKey,
  });

  final String appName;
  final String environment;
  final String apiBaseUrl;
  final String shareBaseUrl;
  final String supabaseUrl;
  final String supabaseAnonKey;

  bool get isProduction => environment == 'prod';

  static AppConfig fromEnvironment() {
    return AppConfig.fromMap(<String, String>{
      'APP_NAME': const String.fromEnvironment(
        'APP_NAME',
        defaultValue: 'MusicDNA',
      ),
      'APP_ENV': const String.fromEnvironment('APP_ENV', defaultValue: 'dev'),
      'API_BASE_URL': const String.fromEnvironment('API_BASE_URL'),
      'SHARE_BASE_URL': const String.fromEnvironment('SHARE_BASE_URL'),
      'SUPABASE_URL': const String.fromEnvironment('SUPABASE_URL'),
      'SUPABASE_ANON_KEY': const String.fromEnvironment('SUPABASE_ANON_KEY'),
    });
  }

  factory AppConfig.fromMap(Map<String, String> values) {
    String requiredValue(String key) {
      final value = values[key]?.trim() ?? '';
      if (value.isEmpty) {
        throw AppConfigException(
          'Missing required configuration value for $key. '
          'Use --dart-define or --dart-define-from-file.',
        );
      }
      return value;
    }

    return AppConfig(
      appName: values['APP_NAME']?.trim().isNotEmpty == true
          ? values['APP_NAME']!.trim()
          : 'MusicDNA',
      environment: values['APP_ENV']?.trim().isNotEmpty == true
          ? values['APP_ENV']!.trim()
          : 'dev',
      apiBaseUrl: requiredValue('API_BASE_URL'),
      shareBaseUrl: values['SHARE_BASE_URL']?.trim().isNotEmpty == true
          ? values['SHARE_BASE_URL']!.trim()
          : requiredValue('API_BASE_URL'),
      supabaseUrl: requiredValue('SUPABASE_URL'),
      supabaseAnonKey: requiredValue('SUPABASE_ANON_KEY'),
    );
  }
}
