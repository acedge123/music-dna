import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static const Color background = Color(0xFF15110F);
  static const Color surface = Color(0xFF0E0B09);
  static const Color surfaceRaised = Color(0xFF1D1714);
  static const Color foreground = Color(0xFFF1E7D6);
  static const Color mutedForeground = Color(0xFFA89A88);
  static const Color ember = Color(0xFFD9342A);
  static const Color gold = Color(0xFFE8B547);
  static const Color teal = Color(0xFF1F6B7A);
  static const Color border = Color(0x26F1E7D6);
  static const Color borderStrong = Color(0x40F1E7D6);

  static ThemeData dark() {
    const colorScheme = ColorScheme(
      brightness: Brightness.dark,
      primary: ember,
      onPrimary: foreground,
      secondary: gold,
      onSecondary: background,
      error: Color(0xFFF16D63),
      onError: foreground,
      surface: surfaceRaised,
      onSurface: foreground,
    );

    final baseTextTheme = GoogleFonts.interTextTheme(
      ThemeData(brightness: Brightness.dark).textTheme,
    ).apply(bodyColor: foreground, displayColor: foreground);

    final displayFont = GoogleFonts.instrumentSerifTextTheme(baseTextTheme);
    final monoStyle = GoogleFonts.jetBrainsMono(
      color: mutedForeground,
      fontSize: 11,
      letterSpacing: 1.8,
      fontWeight: FontWeight.w500,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: background,
      canvasColor: background,
      dividerColor: border,
      textTheme: baseTextTheme.copyWith(
        displayLarge: displayFont.displayLarge?.copyWith(
          fontSize: 64,
          height: 0.95,
          letterSpacing: -1.5,
        ),
        displayMedium: displayFont.displayMedium?.copyWith(
          fontSize: 48,
          height: 0.98,
          letterSpacing: -1.2,
        ),
        headlineLarge: displayFont.headlineLarge?.copyWith(
          fontSize: 40,
          height: 1,
          letterSpacing: -1,
        ),
        headlineMedium: displayFont.headlineMedium?.copyWith(
          fontSize: 32,
          height: 1.05,
          letterSpacing: -0.8,
        ),
        titleMedium: baseTextTheme.titleMedium?.copyWith(
          fontWeight: FontWeight.w700,
        ),
        bodyLarge: baseTextTheme.bodyLarge?.copyWith(
          fontSize: 18,
          height: 1.55,
          color: foreground,
        ),
        bodyMedium: baseTextTheme.bodyMedium?.copyWith(
          height: 1.55,
          color: foreground,
        ),
        bodySmall: baseTextTheme.bodySmall?.copyWith(
          color: mutedForeground,
          height: 1.5,
        ),
        labelSmall: monoStyle,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        foregroundColor: foreground,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
      ),
      cardTheme: CardThemeData(
        color: surfaceRaised,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: border),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: surfaceRaised,
        selectedColor: ember.withValues(alpha: 0.16),
        disabledColor: surfaceRaised,
        labelStyle: baseTextTheme.bodySmall?.copyWith(color: foreground),
        side: const BorderSide(color: border),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surfaceRaised,
        hintStyle: baseTextTheme.bodyMedium?.copyWith(color: mutedForeground),
        labelStyle: baseTextTheme.bodyMedium?.copyWith(color: mutedForeground),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: borderStrong),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Color(0xFFF16D63)),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Color(0xFFF16D63)),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 18,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: ember,
          foregroundColor: foreground,
          disabledBackgroundColor: ember.withValues(alpha: 0.4),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: baseTextTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: foreground,
          side: const BorderSide(color: borderStrong),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: baseTextTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: foreground,
          textStyle: baseTextTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: surfaceRaised,
        contentTextStyle: baseTextTheme.bodyMedium?.copyWith(color: foreground),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}
