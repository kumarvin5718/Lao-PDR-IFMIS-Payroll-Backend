package com.ifmis.payroll.entity.master;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "education_level")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class EducationLevel {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, unique = true, length = 30)
    private String name;
}
