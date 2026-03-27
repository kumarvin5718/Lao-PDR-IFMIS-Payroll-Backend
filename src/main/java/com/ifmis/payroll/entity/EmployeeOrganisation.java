package com.ifmis.payroll.entity;

import com.ifmis.payroll.entity.master.Department;
import com.ifmis.payroll.entity.master.Ministry;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "employee_organisation")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmployeeOrganisation {
    // primary key
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false)
    private UUID id;

    // Employee Id
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_code", nullable = false, unique = true)
    private EmployeePersonalInformation employee;


    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ministry_id", nullable = false)
    private Ministry ministry;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id", nullable = false)
    private Department department;

    // ** Check this:
    @Column(name = "division", nullable = false)
    private String division;
}


