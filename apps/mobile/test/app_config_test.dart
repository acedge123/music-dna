import 'package:flutter_test/flutter_test.dart';
import 'package:music_dna/src/core/config/app_config.dart';

void main() {
  test('builds config from explicit values', () {
    final config = AppConfig.fromMap(const <String, String>{
      'APP_NAME': 'MusicDNA',
      'APP_ENV': 'dev',
      'API_BASE_URL': 'https://example.com',
      'SUPABASE_URL': 'https://example.supabase.co',
      'SUPABASE_ANON_KEY': 'anon-key',
    });

    expect(config.appName, 'MusicDNA');
    expect(config.environment, 'dev');
    expect(config.apiBaseUrl, 'https://example.com');
    expect(config.shareBaseUrl, 'https://example.com');
    expect(config.supabaseUrl, 'https://example.supabase.co');
    expect(config.supabaseAnonKey, 'anon-key');
  });

  test('uses explicit share base url when provided', () {
    final config = AppConfig.fromMap(const <String, String>{
      'API_BASE_URL': 'https://api.example.com',
      'SHARE_BASE_URL': 'https://www.example.com',
      'SUPABASE_URL': 'https://example.supabase.co',
      'SUPABASE_ANON_KEY': 'anon-key',
    });

    expect(config.shareBaseUrl, 'https://www.example.com');
  });

  test('throws when a required value is missing', () {
    expect(
      () => AppConfig.fromMap(const <String, String>{}),
      throwsA(isA<AppConfigException>()),
    );
  });
}
