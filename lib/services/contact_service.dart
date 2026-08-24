import 'dart:convert';

import 'auth_store.dart';
import 'backend_service.dart';

class EmergencyContact {
  final String? id;
  final String name;
  final String phone;
  final String? relationship;

  EmergencyContact({
    this.id,
    required this.name,
    required this.phone,
    this.relationship,
  });

  factory EmergencyContact.fromJson(Map<String, dynamic> json) {
    return EmergencyContact(
      id: json['_id']?.toString() ?? json['id']?.toString(),
      name: json['name'],
      phone: json['phone'],
      relationship: json['relationship'],
    );
  }
}

class ContactService {
  Future<List<EmergencyContact>> getContacts() async {
    if (!await AuthStore.hasSession()) return [];

    try {
      // The backend returns the contacts belonging to the authenticated user.
      final response = await BackendService.get('/contacts');

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final List list = data['contacts'] ?? [];
        return list.map((json) => EmergencyContact.fromJson(json)).toList();
      }
    } catch (e) {
      // ignore and return empty
    }

    return [];
  }

  Future<bool> addContact(
    String name,
    String phone,
    String relationship,
  ) async {
    if (!await AuthStore.hasSession()) return false;

    try {
      final response = await BackendService.post(
        '/contacts',
        body: jsonEncode({
          'name': name,
          'phone': phone,
          'relationship': relationship,
        }),
      );

      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  Future<bool> deleteContact(String id) async {
    try {
      final response = await BackendService.delete('/contacts/$id');
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  Future<bool> updateContact(
    String id,
    String name,
    String phone,
    String relationship,
  ) async {
    try {
      final response = await BackendService.post(
        '/contacts/$id',
        body: jsonEncode({
          'name': name,
          'phone': phone,
          'relationship': relationship,
        }),
      );

      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }
}
