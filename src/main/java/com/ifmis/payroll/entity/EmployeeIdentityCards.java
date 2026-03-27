package com.ifmis.payroll.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "employee_identity_cards")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmployeeIdentityCards{
    // primary key
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false)
    private UUID id;

    // Employee Id
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_code", nullable = false, unique = true)
    private EmployeePersonalInformation employee;

    // Civil Service Card ID: 16 digits numeric
    @Column(name = "civil_service_card_id", length = 16, nullable = false, unique = true)
    private String civilServiceCardId;

    // Social Security No: 12 Char alphanumeric
    @Column(name = "civil_service_card_id", length = 16, nullable = false)
    private String social_security_number;
}
