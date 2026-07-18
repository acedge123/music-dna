import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import 'app_api_exception.dart';

typedef AccessTokenProvider = Future<String?> Function();

class MusicDnaApiClient {
  MusicDnaApiClient({
    required String baseUrl,
    required AccessTokenProvider accessTokenProvider,
    http.Client? httpClient,
  }) : _baseUri = Uri.parse(baseUrl),
       _accessTokenProvider = accessTokenProvider,
       _httpClient = httpClient ?? http.Client();

  static const Duration _requestTimeout = Duration(seconds: 20);

  final Uri _baseUri;
  final AccessTokenProvider _accessTokenProvider;
  final http.Client _httpClient;

  Uri buildUri(String path) => _baseUri.resolve(path);

  Future<http.Response> get(String path) async {
    try {
      return _httpClient
          .get(buildUri(path), headers: await _headers())
          .timeout(_requestTimeout);
    } on TimeoutException {
      throw AppApiException(
        kind: AppApiErrorKind.network,
        message: 'The request timed out. Check your connection and try again.',
      );
    } on SocketException {
      throw AppApiException(
        kind: AppApiErrorKind.network,
        message: 'No network connection is available right now.',
      );
    } on http.ClientException catch (error) {
      throw AppApiException(
        kind: AppApiErrorKind.network,
        message: error.message,
      );
    }
  }

  Future<http.Response> post(String path, {Map<String, dynamic>? body}) async {
    try {
      return _httpClient
          .post(
            buildUri(path),
            headers: await _headers(),
            body: body == null ? null : jsonEncode(body),
          )
          .timeout(_requestTimeout);
    } on TimeoutException {
      throw AppApiException(
        kind: AppApiErrorKind.network,
        message: 'The request timed out. Check your connection and try again.',
      );
    } on SocketException {
      throw AppApiException(
        kind: AppApiErrorKind.network,
        message: 'No network connection is available right now.',
      );
    } on http.ClientException catch (error) {
      throw AppApiException(
        kind: AppApiErrorKind.network,
        message: error.message,
      );
    }
  }

  Future<http.Response> delete(String path) async {
    try {
      return _httpClient
          .delete(buildUri(path), headers: await _headers())
          .timeout(_requestTimeout);
    } on TimeoutException {
      throw AppApiException(
        kind: AppApiErrorKind.network,
        message: 'The request timed out. Check your connection and try again.',
      );
    } on SocketException {
      throw AppApiException(
        kind: AppApiErrorKind.network,
        message: 'No network connection is available right now.',
      );
    } on http.ClientException catch (error) {
      throw AppApiException(
        kind: AppApiErrorKind.network,
        message: error.message,
      );
    }
  }

  Future<Map<String, String>> _headers() async {
    final accessToken = await _accessTokenProvider();
    return <String, String>{
      'content-type': 'application/json',
      if (accessToken != null && accessToken.isNotEmpty)
        'authorization': 'Bearer $accessToken',
    };
  }
}
