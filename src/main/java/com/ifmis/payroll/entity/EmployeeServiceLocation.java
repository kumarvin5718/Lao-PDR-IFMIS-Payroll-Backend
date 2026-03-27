package com.ifmis.payroll.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "employee_service_location")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmployeeServiceLocation {
    // primary key
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(nullable = false, updatable = false)
    private UUID id;

//    need attention***
    @Column(name = "service_province")
    private String serviceProvince;

//    need attention***
    @Column(name = "service_district")
    private String serviceDistrict;

//    need attention***
    private String ProfessionCategory;

    @Column(name = "is_remote_area")
    private Boolean isRemoteArea;

    @Column(name = "is_foreign_area")
    private Boolean isForeignArea;

    @Column(name = "is_hazardous_area")
    private Boolean isHazardousArea;

}
