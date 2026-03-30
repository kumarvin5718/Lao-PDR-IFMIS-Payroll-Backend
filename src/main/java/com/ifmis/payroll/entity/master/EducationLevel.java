package com.ifmis.payroll.entity.master;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "education_level")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class EducationLevel {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "name", nullable = false, unique = true, length = 30)
    private String name;
}
