import 'package:flutter/material.dart';

import '../services/session_service.dart';
import '../widgets/sleek_animation.dart';
import 'login_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = SessionService();

    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      appBar: AppBar(
        title: const Text('My Identity', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF1E1E1E),
        foregroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SafeArea(
        child: FutureBuilder<Map<String, dynamic>?>(
          future: session.loadProfile(),
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(
                child: CircularProgressIndicator(),
              );
            }

            final profile = snapshot.data ?? {};
            final fullName = profile['fullName'] ?? '';
            final docType = profile['documentType'] ?? '';
            final docNum = profile['passport'] ?? '';
            final nationality = profile['nationality'] ?? '';

            final isStudent = profile['isStudent'] ?? false;
            final isWorking = profile['isWorking'] ?? false;
            final universityName = profile['universityName'] ?? '';
            final organizationName = profile['organizationName'] ?? '';

            final bloodGroup = profile['bloodGroup'] ?? '';
            final allergies = profile['allergies'] ?? '';
            final medicalConditions = profile['medicalConditions'] ?? '';

            String statusLabel = 'Other / Not Specified';
            IconData statusIcon = Icons.info_outline;
            if (isStudent) {
              statusLabel = 'Student at ${universityName.isEmpty ? 'Unknown University' : universityName}';
              statusIcon = Icons.school_outlined;
            } else if (isWorking) {
              statusLabel = 'Working at ${organizationName.isEmpty ? 'Unknown Organisation' : organizationName}';
              statusIcon = Icons.business_outlined;
            }

            return SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
              child: Column(
                children: [
                  // --- AVATAR SECTION ---
                  SleekAnimation(
                    type: SleekAnimationType.scale,
                    child: Center(
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.blue.shade400.withOpacity(0.3), width: 2),
                        ),
                        child: CircleAvatar(
                          radius: 56,
                          backgroundColor: const Color(0xFF1E1E1E),
                          child: Icon(Icons.person_rounded, size: 50, color: Colors.blue.shade400),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  SleekAnimation(
                    delay: const Duration(milliseconds: 200),
                    child: Text(
                      fullName.isEmpty ? 'Anonymous User' : fullName,
                      style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(height: 4),
                  const SleekAnimation(
                    delay: Duration(milliseconds: 250),
                    child: Text(
                      'Verified Identity',
                      style: TextStyle(color: Colors.blue, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1),
                    ),
                  ),

                  const SizedBox(height: 40),

                  // --- PROFILE DATA ---
                  SleekAnimation(
                    delay: const Duration(milliseconds: 300),
                    type: SleekAnimationType.slide,
                    slideOffset: const Offset(0.05, 0),
                    child: _infoTile('Academic / Professional Status', statusLabel, statusIcon),
                  ),
                  SleekAnimation(
                    delay: const Duration(milliseconds: 400),
                    type: SleekAnimationType.slide,
                    slideOffset: const Offset(0.05, 0),
                    child: _infoTile('Document Type', docType, Icons.description_outlined),
                  ),
                  SleekAnimation(
                    delay: const Duration(milliseconds: 500),
                    type: SleekAnimationType.slide,
                    slideOffset: const Offset(0.05, 0),
                    child: _infoTile('Document Number', docNum, Icons.badge_outlined),
                  ),
                  SleekAnimation(
                    delay: const Duration(milliseconds: 600),
                    type: SleekAnimationType.slide,
                    slideOffset: const Offset(0.05, 0),
                    child: _infoTile('Nationality', nationality, Icons.public_outlined),
                  ),
                  if (bloodGroup.isNotEmpty)
                    SleekAnimation(
                      delay: const Duration(milliseconds: 700),
                      type: SleekAnimationType.slide,
                      slideOffset: const Offset(0.05, 0),
                      child: _infoTile('Blood Group', bloodGroup, Icons.bloodtype_outlined, color: Colors.red.shade400),
                    ),
                  if (allergies.isNotEmpty)
                    SleekAnimation(
                      delay: const Duration(milliseconds: 800),
                      type: SleekAnimationType.slide,
                      slideOffset: const Offset(0.05, 0),
                      child: _infoTile('Allergies', allergies, Icons.warning_amber_rounded, color: Colors.orange.shade400),
                    ),
                  if (medicalConditions.isNotEmpty)
                    SleekAnimation(
                      delay: const Duration(milliseconds: 900),
                      type: SleekAnimationType.slide,
                      slideOffset: const Offset(0.05, 0),
                      child: _infoTile('Medical Conditions', medicalConditions, Icons.health_and_safety_outlined, color: Colors.red.shade400),
                    ),

                  const SizedBox(height: 32),

                  // --- LOGOUT ACTION ---
                  SleekAnimation(
                    delay: const Duration(milliseconds: 1000),
                    type: SleekAnimationType.slide,
                    slideOffset: const Offset(0, 0.1),
                    child: SizedBox(
                      width: double.infinity,
                      height: 60,
                      child: TextButton.icon(
                        style: TextButton.styleFrom(
                          foregroundColor: Colors.red.shade400,
                          backgroundColor: Colors.red.withOpacity(0.05),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        ),
                        onPressed: () async {
                          await session.logout();
                          if (!context.mounted) return;
                          Navigator.pushAndRemoveUntil(
                            context,
                            MaterialPageRoute(builder: (_) => const LoginScreen()),
                            (route) => false,
                          );
                        },
                        icon: const Icon(Icons.logout_rounded),
                        label: const Text('SIGN OUT', style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1)),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _infoTile(String label, String value, IconData icon, {Color? color}) {
    final activeColor = color ?? Colors.grey.shade600;
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.03)),
      ),
      child: Row(
        children: [
          Icon(icon, color: activeColor, size: 22),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label.toUpperCase(), style: const TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1)),
                const SizedBox(height: 2),
                Text(value.isEmpty ? 'Not Provided' : value, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
