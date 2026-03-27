package com.ifmis.payroll.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "employee_residential_address")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmployeeResidentialAddress {
    // primary key
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false)
    private UUID id;

    // Employee Id
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_code", nullable = false, unique = true)
    private EmployeePersonalInformation employee;

    @Column(name = "house_no", nullable = false)
    private String houseNo;

    @Column(name = "street", nullable = false)
    private String street;

    @Column(name = "area", nullable = false)
    private String area;

    // Need to check ***
    @Column(name = "province_of_residence", nullable = false)
    private String provinceOfResidence;

    @Column(name = "pin_code", nullable = false)
    private String pinCode;

    @Column(name = "country", nullable = false)
    private String Country;
}
