import '../utils/parsers.dart';

class User {
  final String id;
  final String email;
  final String phone;
  final String name;
  final String role;
  final String? licenseNumber;
  final bool mustChangePassword;
  final bool identityVerified;
  final String? identityPhotoUrl;
  final String? idCardFront;
  final String? idCardBack;
  final double? lastKnownLat;
  final double? lastKnownLng;
  final DateTime? lastLocationAt;
  final bool isActive;
  final String? avatarUrl;
  final DateTime? lastBiometricVerifiedAt;

  User({
    required this.id,
    required this.email,
    required this.phone,
    required this.name,
    required this.role,
    this.licenseNumber,
    required this.mustChangePassword,
    required this.identityVerified,
    this.identityPhotoUrl,
    this.idCardFront,
    this.idCardBack,
    this.lastKnownLat,
    this.lastKnownLng,
    this.lastLocationAt,
    required this.isActive,
    this.avatarUrl,
    this.lastBiometricVerifiedAt,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: (json['id'] ?? '').toString(),
      email: (json['email'] ?? '').toString(),
      phone: (json['phone'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      role: (json['role'] ?? '').toString(),
      licenseNumber:
          (json['licenseNumber'] ?? json['license_number'])?.toString(),
      mustChangePassword: parseBool(
        json['mustChangePassword'] ?? json['must_change_password'],
        false,
      ),
      identityVerified: parseBool(
        json['identityVerified'] ?? json['identity_verified'],
        false,
      ),
      identityPhotoUrl:
          (json['identityPhotoUrl'] ?? json['identity_photo_url'])?.toString(),
      idCardFront: (json['idCardFront'] ?? json['id_card_front'])?.toString(),
      idCardBack: (json['idCardBack'] ?? json['id_card_back'])?.toString(),
      lastKnownLat: parseDouble(json['lastKnownLat'] ?? json['last_known_lat']),
      lastKnownLng: parseDouble(json['lastKnownLng'] ?? json['last_known_lng']),
      lastLocationAt: (json['lastLocationAt'] ?? json['last_location_at']) !=
              null
          ? DateTime.tryParse(
              (json['lastLocationAt'] ?? json['last_location_at']).toString())
          : null,
      isActive: parseBool(json['isActive'] ?? json['is_active'], true),
      avatarUrl: (json['avatarUrl'] ??
              json['profilePhotoUrl'] ??
              json['avatar_url'] ??
              json['profile_photo_url'])
          ?.toString(),
      lastBiometricVerifiedAt: (json['lastBiometricVerifiedAt'] ??
                  json['last_biometric_verified_at']) !=
              null
          ? DateTime.tryParse((json['lastBiometricVerifiedAt'] ??
                  json['last_biometric_verified_at'])
              .toString())
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'phone': phone,
        'name': name,
        'role': role,
        'licenseNumber': licenseNumber,
        'mustChangePassword': mustChangePassword,
        'identityVerified': identityVerified,
        'identityPhotoUrl': identityPhotoUrl,
        'idCardFront': idCardFront,
        'idCardBack': idCardBack,
        'lastKnownLat': lastKnownLat,
        'lastKnownLng': lastKnownLng,
        'lastLocationAt': lastLocationAt?.toIso8601String(),
        'isActive': isActive,
        'avatarUrl': avatarUrl,
        'lastBiometricVerifiedAt': lastBiometricVerifiedAt?.toIso8601String(),
      };
}

class Vehicle {
  final String id;
  final String plateNumber;
  final String model;
  final int year;
  final int capacity;
  final String qrCode;
  final String status;
  final bool isActive;

  Vehicle({
    required this.id,
    required this.plateNumber,
    required this.model,
    required this.year,
    required this.capacity,
    required this.qrCode,
    required this.status,
    required this.isActive,
  });

  factory Vehicle.fromJson(Map<String, dynamic> json) {
    return Vehicle(
      id: (json['id'] ?? '').toString(),
      plateNumber: (json['plateNumber'] ?? '').toString(),
      model: (json['model'] ?? '').toString(),
      year: parseIntWithDefault(json['year'], 0),
      capacity: parseIntWithDefault(json['capacity'], 0),
      qrCode: (json['qrCode'] ?? '').toString(),
      status: (json['status'] ?? '').toString(),
      isActive: parseBool(json['isActive'], true),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'plateNumber': plateNumber,
        'model': model,
        'year': year,
        'capacity': capacity,
        'qrCode': qrCode,
        'status': status,
        'isActive': isActive,
      };
}

class Shift {
  final String id;
  final String driverId;
  final String? vehicleId;
  final String status;
  final DateTime? startedAt;
  final DateTime? closedAt;
  final String? closeReason;
  final String? startSelfieUrl;
  final String verificationStatus;
  final Vehicle? vehicle;

  Shift({
    required this.id,
    required this.driverId,
    this.vehicleId,
    required this.status,
    this.startedAt,
    this.closedAt,
    this.closeReason,
    this.startSelfieUrl,
    required this.verificationStatus,
    this.vehicle,
  });

  factory Shift.fromJson(Map<String, dynamic> json) {
    return Shift(
      id: (json['id'] ?? '').toString(),
      driverId: (json['driverId'] ?? '').toString(),
      vehicleId: json['vehicleId']?.toString(),
      status: (json['status'] ?? '').toString(),
      startedAt: json['startedAt'] != null
          ? DateTime.tryParse(json['startedAt'].toString())
          : null,
      closedAt: json['closedAt'] != null
          ? DateTime.tryParse(json['closedAt'].toString())
          : null,
      closeReason: json['closeReason']?.toString(),
      startSelfieUrl: json['startSelfieUrl']?.toString(),
      verificationStatus: (json['verificationStatus'] ?? 'PENDING').toString(),
      vehicle: json['vehicle'] != null
          ? Vehicle.fromJson(Map<String, dynamic>.from(json['vehicle'] as Map))
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'driverId': driverId,
        'vehicleId': vehicleId,
        'status': status,
        'startedAt': startedAt?.toIso8601String(),
        'closedAt': closedAt?.toIso8601String(),
        'closeReason': closeReason,
        'startSelfieUrl': startSelfieUrl,
        'verificationStatus': verificationStatus,
        'vehicle': vehicle?.toJson(),
      };
}

class Passenger {
  final String name;
  final String phone;
  final int companionCount;
  final int bagCount;

  Passenger({
    required this.name,
    required this.phone,
    required this.companionCount,
    required this.bagCount,
  });

  factory Passenger.fromJson(Map<String, dynamic> json) {
    return Passenger(
      name: (json['name'] ?? '').toString(),
      phone: (json['phone'] ?? '').toString(),
      companionCount: parseIntWithDefault(json['companionCount'], 0),
      bagCount: parseIntWithDefault(json['bagCount'], 0),
    );
  }

  Map<String, dynamic> toJson() => {
        'name': name,
        'phone': phone,
        'companionCount': companionCount,
        'bagCount': bagCount,
      };
}

class Trip {
  final String id;
  final String driverId;
  final String? shiftId;
  final String? vehicleId;
  final String pickupLocation;
  final String dropoffLocation;
  final String paymentMethod;
  final DateTime? cashCollectedAt;
  final String? cashCollectedBy;
  final String? cashCollectedNote;
  final double pickupLat;
  final double pickupLng;
  final double dropoffLat;
  final double dropoffLng;
  final DateTime? scheduledTime;
  final double price;
  final double adminCharge;
  final double driverNetPrice;
  final DateTime? actualStartTime;
  final DateTime? actualEndTime;
  final String? cancellationReason;
  final String? cancelledBy;
  final String status;
  final List<Passenger>? passengers;
  final Vehicle? vehicle;

  Trip({
    required this.id,
    required this.driverId,
    this.shiftId,
    this.vehicleId,
    required this.pickupLocation,
    required this.dropoffLocation,
    required this.paymentMethod,
    this.cashCollectedAt,
    this.cashCollectedBy,
    this.cashCollectedNote,
    required this.pickupLat,
    required this.pickupLng,
    required this.dropoffLat,
    required this.dropoffLng,
    this.scheduledTime,
    required this.price,
    required this.adminCharge,
    required this.driverNetPrice,
    this.actualStartTime,
    this.actualEndTime,
    this.cancellationReason,
    this.cancelledBy,
    required this.status,
    this.passengers,
    this.vehicle,
  });

  factory Trip.fromJson(Map<String, dynamic> json) {
    List<Passenger>? parsedPassengers;
    if (json['passengers'] != null) {
      if (json['passengers'] is List) {
        parsedPassengers = (json['passengers'] as List)
            .map((e) => Passenger.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList();
      }
    }
    return Trip(
      id: (json['id'] ?? '').toString(),
      driverId: (json['driverId'] ?? '').toString(),
      shiftId: json['shiftId']?.toString(),
      vehicleId: json['vehicleId']?.toString(),
      pickupLocation: (json['pickupLocation'] ?? '').toString(),
      dropoffLocation: (json['dropoffLocation'] ?? '').toString(),
      paymentMethod: (json['paymentMethod'] ?? 'CASH').toString(),
      cashCollectedAt: json['cashCollectedAt'] != null
          ? DateTime.tryParse(json['cashCollectedAt'].toString())
          : null,
      cashCollectedBy: json['cashCollectedBy']?.toString(),
      cashCollectedNote: json['cashCollectedNote']?.toString(),
      pickupLat: parseDoubleWithDefault(json['pickupLat'], 0.0),
      pickupLng: parseDoubleWithDefault(json['pickupLng'], 0.0),
      dropoffLat: parseDoubleWithDefault(json['dropoffLat'], 0.0),
      dropoffLng: parseDoubleWithDefault(json['dropoffLng'], 0.0),
      scheduledTime: json['scheduledTime'] != null
          ? DateTime.tryParse(json['scheduledTime'].toString())
          : null,
      price: parseDoubleWithDefault(json['price'], 0.0),
      adminCharge: parseDoubleWithDefault(json['adminCharge'], 0.0),
      driverNetPrice: parseDoubleWithDefault(json['driverNetPrice'], 0.0),
      actualStartTime: json['actualStartTime'] != null
          ? DateTime.tryParse(json['actualStartTime'].toString())
          : null,
      actualEndTime: json['actualEndTime'] != null
          ? DateTime.tryParse(json['actualEndTime'].toString())
          : null,
      cancellationReason: json['cancellationReason']?.toString(),
      cancelledBy: json['cancelledBy']?.toString(),
      status: (json['status'] ?? '').toString(),
      passengers: parsedPassengers,
      vehicle: json['vehicle'] != null
          ? Vehicle.fromJson(Map<String, dynamic>.from(json['vehicle'] as Map))
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'driverId': driverId,
        'shiftId': shiftId,
        'vehicleId': vehicleId,
        'pickupLocation': pickupLocation,
        'dropoffLocation': dropoffLocation,
        'paymentMethod': paymentMethod,
        'cashCollectedAt': cashCollectedAt?.toIso8601String(),
        'cashCollectedBy': cashCollectedBy,
        'cashCollectedNote': cashCollectedNote,
        'pickupLat': pickupLat,
        'pickupLng': pickupLng,
        'dropoffLat': dropoffLat,
        'dropoffLng': dropoffLng,
        'scheduledTime': scheduledTime?.toIso8601String(),
        'price': price,
        'adminCharge': adminCharge,
        'driverNetPrice': driverNetPrice,
        'actualStartTime': actualStartTime?.toIso8601String(),
        'actualEndTime': actualEndTime?.toIso8601String(),
        'cancellationReason': cancellationReason,
        'cancelledBy': cancelledBy,
        'status': status,
        'passengers': passengers?.map((e) => e.toJson()).toList(),
        'vehicle': vehicle?.toJson(),
      };
}

class InspectionPhoto {
  final String id;
  final String inspectionId;
  final String direction;
  final String photoUrl;
  final DateTime uploadedAt;

  InspectionPhoto({
    required this.id,
    required this.inspectionId,
    required this.direction,
    required this.photoUrl,
    required this.uploadedAt,
  });

  factory InspectionPhoto.fromJson(Map<String, dynamic> json) {
    return InspectionPhoto(
      id: json['id'] as String,
      inspectionId: json['inspectionId'] as String,
      direction: json['direction'] as String,
      photoUrl: json['photoUrl'] as String,
      uploadedAt: DateTime.parse(json['uploadedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'inspectionId': inspectionId,
        'direction': direction,
        'photoUrl': photoUrl,
        'uploadedAt': uploadedAt.toIso8601String(),
      };
}

class Inspection {
  final String id;
  final String shiftId;
  final String vehicleId;
  final String driverId;
  final String type;
  final String status;
  final int? mileage;
  final Map<String, dynamic>? checklistData;
  final DateTime createdAt;
  final DateTime? completedAt;
  final List<InspectionPhoto>? photos;

  Inspection({
    required this.id,
    required this.shiftId,
    required this.vehicleId,
    required this.driverId,
    required this.type,
    required this.status,
    this.mileage,
    this.checklistData,
    required this.createdAt,
    this.completedAt,
    this.photos,
  });

  factory Inspection.fromJson(Map<String, dynamic> json) {
    return Inspection(
      id: (json['id'] ?? '').toString(),
      shiftId: (json['shiftId'] ?? '').toString(),
      vehicleId: (json['vehicleId'] ?? '').toString(),
      driverId: (json['driverId'] ?? '').toString(),
      type: (json['type'] ?? '').toString(),
      status: (json['status'] ?? '').toString(),
      mileage: parseInt(json['mileage']),
      checklistData: json['checklistData'] as Map<String, dynamic>?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      completedAt: json['completedAt'] != null
          ? DateTime.parse(json['completedAt'] as String)
          : null,
      photos: json['photos'] != null
          ? (json['photos'] as List)
              .map((e) =>
                  InspectionPhoto.fromJson(Map<String, dynamic>.from(e as Map)))
              .toList()
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'shiftId': shiftId,
        'vehicleId': vehicleId,
        'driverId': driverId,
        'type': type,
        'status': status,
        'mileage': mileage,
        'checklistData': checklistData,
        'createdAt': createdAt.toIso8601String(),
        'completedAt': completedAt?.toIso8601String(),
        'photos': photos?.map((e) => e.toJson()).toList(),
      };
}

class ExpenseCategory {
  final String id;
  final String name;
  final bool isActive;
  final bool requiresApproval;

  ExpenseCategory({
    required this.id,
    required this.name,
    required this.isActive,
    required this.requiresApproval,
  });

  factory ExpenseCategory.fromJson(Map<String, dynamic> json) {
    return ExpenseCategory(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      isActive: parseBool(json['isActive'], true),
      requiresApproval: parseBool(json['requiresApproval'], false),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'isActive': isActive,
        'requiresApproval': requiresApproval,
      };
}

class Expense {
  final String id;
  final String shiftId;
  final String? tripId;
  final String driverId;
  final String categoryId;
  final double amount;
  final String? description;
  final String? receiptUrl;
  final String status;
  final DateTime createdAt;
  final ExpenseCategory? category;

  Expense({
    required this.id,
    required this.shiftId,
    this.tripId,
    required this.driverId,
    required this.categoryId,
    required this.amount,
    this.description,
    this.receiptUrl,
    required this.status,
    required this.createdAt,
    this.category,
  });

  factory Expense.fromJson(Map<String, dynamic> json) {
    return Expense(
      id: (json['id'] ?? '').toString(),
      shiftId: (json['shiftId'] ?? '').toString(),
      tripId: json['tripId']?.toString(),
      driverId: (json['driverId'] ?? '').toString(),
      categoryId: (json['categoryId'] ?? '').toString(),
      amount: parseDoubleWithDefault(json['amount'], 0.0),
      description: json['description']?.toString(),
      receiptUrl: json['receiptUrl']?.toString(),
      status: (json['status'] ?? '').toString(),
      createdAt: DateTime.parse(json['createdAt'] as String),
      category: json['category'] != null
          ? ExpenseCategory.fromJson(
              Map<String, dynamic>.from(json['category'] as Map))
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'shiftId': shiftId,
        'tripId': tripId,
        'driverId': driverId,
        'categoryId': categoryId,
        'amount': amount,
        'description': description,
        'receiptUrl': receiptUrl,
        'status': status,
        'createdAt': createdAt.toIso8601String(),
        'category': category?.toJson(),
      };
}

class DamagePhoto {
  final String id;
  final String damageReportId;
  final String photoUrl;
  final DateTime uploadedAt;

  DamagePhoto({
    required this.id,
    required this.damageReportId,
    required this.photoUrl,
    required this.uploadedAt,
  });

  factory DamagePhoto.fromJson(Map<String, dynamic> json) {
    return DamagePhoto(
      id: json['id'] as String,
      damageReportId: json['damageReportId'] as String,
      photoUrl: json['photoUrl'] as String,
      uploadedAt: DateTime.parse(json['uploadedAt'] as String),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'damageReportId': damageReportId,
        'photoUrl': photoUrl,
        'uploadedAt': uploadedAt.toIso8601String(),
      };
}

class DamageReport {
  final String id;
  final String vehicleId;
  final String driverId;
  final String? tripId;
  final String shiftId;
  final String description;
  final String status;
  final DateTime createdAt;
  final List<DamagePhoto>? photos;

  DamageReport({
    required this.id,
    required this.vehicleId,
    required this.driverId,
    this.tripId,
    required this.shiftId,
    required this.description,
    required this.status,
    required this.createdAt,
    this.photos,
  });

  factory DamageReport.fromJson(Map<String, dynamic> json) {
    return DamageReport(
      id: json['id'] as String,
      vehicleId: json['vehicleId'] as String,
      driverId: json['driverId'] as String,
      tripId: json['tripId'] as String?,
      shiftId: json['shiftId'] as String,
      description: json['description'] as String? ?? '',
      status: json['status'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      photos: json['photos'] != null
          ? (json['photos'] as List)
              .map((e) => DamagePhoto.fromJson(e as Map<String, dynamic>))
              .toList()
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'vehicleId': vehicleId,
        'driverId': driverId,
        'tripId': tripId,
        'shiftId': shiftId,
        'description': description,
        'status': status,
        'createdAt': createdAt.toIso8601String(),
        'photos': photos?.map((e) => e.toJson()).toList(),
      };
}

class TrafficViolation {
  final String id;
  final String driverId;
  final String vehicleId;
  final String violationNumber;
  final String? photoUrl;
  final DateTime date;
  final String time;
  final String location;
  final double fineAmount;
  final DateTime? seenAt;
  final DateTime createdAt;

  TrafficViolation({
    required this.id,
    required this.driverId,
    required this.vehicleId,
    required this.violationNumber,
    this.photoUrl,
    required this.date,
    required this.time,
    required this.location,
    required this.fineAmount,
    this.seenAt,
    required this.createdAt,
  });

  factory TrafficViolation.fromJson(Map<String, dynamic> json) {
    return TrafficViolation(
      id: (json['id'] ?? '').toString(),
      driverId: (json['driverId'] ?? '').toString(),
      vehicleId: (json['vehicleId'] ?? '').toString(),
      violationNumber: (json['violationNumber'] ?? '').toString(),
      photoUrl: json['photoUrl']?.toString(),
      date: DateTime.parse(json['date'] as String),
      time: (json['time'] ?? '').toString(),
      location: (json['location'] ?? '').toString(),
      fineAmount: parseDoubleWithDefault(json['fineAmount'], 0.0),
      seenAt: json['seenAt'] != null
          ? DateTime.parse(json['seenAt'] as String)
          : null,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'driverId': driverId,
        'vehicleId': vehicleId,
        'violationNumber': violationNumber,
        'photoUrl': photoUrl,
        'date': date.toIso8601String(),
        'time': time,
        'location': location,
        'fineAmount': fineAmount,
        'seenAt': seenAt?.toIso8601String(),
        'createdAt': createdAt.toIso8601String(),
      };
}

class NotificationModel {
  final String id;
  final String userId;
  final String title;
  final String body;
  final String type;
  final String? entityId;
  final bool isRead;
  final DateTime createdAt;

  NotificationModel({
    required this.id,
    required this.userId,
    required this.title,
    required this.body,
    required this.type,
    this.entityId,
    required this.isRead,
    required this.createdAt,
  });

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    final createdAtRaw =
        json['createdAt'] ?? json['created_at'] ?? json['timestamp'];
    return NotificationModel(
      id: (json['id'] ?? '').toString(),
      userId: (json['userId'] ?? json['user_id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      body: (json['body'] ?? json['message'] ?? '').toString(),
      type: (json['type'] ?? '').toString(),
      entityId: (json['entityId'] ?? json['entity_id'])?.toString(),
      isRead: parseBool(json['isRead'] ?? json['is_read'], false),
      createdAt:
          DateTime.tryParse(createdAtRaw?.toString() ?? '') ?? DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'userId': userId,
        'title': title,
        'body': body,
        'type': type,
        'entityId': entityId,
        'isRead': isRead,
        'createdAt': createdAt.toIso8601String(),
      };
}
